import AWS from 'aws-sdk';
import { ErrorRatchet, Logger, StopWatch, StringRatchet } from '@bitblit/ratchet/dist/common';
import { Context, SNSEvent } from 'aws-lambda';
import { LambdaEventDetector, S3CacheRatchet } from '@bitblit/ratchet/dist/aws';
import { EpsilonConstants } from '../epsilon-constants';
import { ModelValidator } from '@bitblit/ratchet/dist/model-validator';
import { BackgroundManager } from '../background-manager';
import { BackgroundValidator } from './background-validator';
import { BackgroundConfig } from '../config/background/background-config';
import { BackgroundProcessor } from '../config/background/background-processor';
import { InternalBackgroundEntry } from './internal-background-entry';
import { BackgroundTransactionLog } from '../config/background/background-transaction-log';

/**
 * We use a FIFO queue so that 2 different Lambdas don't both work on the same
 * thing at the same time.
 */
export class BackgroundHandler {
  private processors: Map<string, BackgroundProcessor<any>>;
  private validator: BackgroundValidator;
  private s3TransactionLogCacheRatchet: S3CacheRatchet;

  constructor(private cfg: BackgroundConfig, private mgr: BackgroundManager, private modelValidator?: ModelValidator) {
    const cfgErrors: string[] = BackgroundValidator.validateConfig(cfg);
    if (cfgErrors.length > 0) {
      ErrorRatchet.throwFormattedErr('Invalid background config : %j : %j', cfgErrors, cfg);
    }
    Logger.silly('Starting Background processor, %d processors', cfg.processors.length);
    this.validator = new BackgroundValidator(cfg, modelValidator);
    this.processors = BackgroundValidator.validateAndMapProcessors(cfg.processors, modelValidator);
    if (this.cfg.s3TransactionLoggingConfig) {
      this.s3TransactionLogCacheRatchet = new S3CacheRatchet(
        this.cfg.s3TransactionLoggingConfig.s3,
        this.cfg.s3TransactionLoggingConfig.bucket
      );
    }

    if (mgr) {
      // We always subscribe, but check on a case-by-case basis so we can attach/detach
      // local mode at runtime
      Logger.info('Attaching local-mode background manager bus');
      mgr.localBus().subscribe(async (evt) => {
        if (mgr.localMode) {
          Logger.debug('Processing local background entry : %j', evt);
          const rval: boolean = await this.processSingleBackgroundEntry(evt);
          Logger.info('Processor returned %s', rval);
        } else {
          Logger.silly('Not local mode - ignoring');
        }
      });
    }
  }

  // eslint-disable-next-line  @typescript-eslint/explicit-module-boundary-types
  public isBackgroundSNSEvent(event: any): boolean {
    return this.isBackgroundStartSnsEvent(event) || this.isBackgroundImmediateFireEvent(event);
  }

  // eslint-disable-next-line  @typescript-eslint/explicit-module-boundary-types
  public isBackgroundStartSnsEvent(event: any): boolean {
    let rval: boolean = false;
    if (event) {
      if (LambdaEventDetector.isSingleSnsEvent(event)) {
        const cast: SNSEvent = event as SNSEvent;
        rval = cast.Records[0].Sns.Message === EpsilonConstants.BACKGROUND_SNS_START_MARKER;
      }
    }
    return rval;
  }

  // eslint-disable-next-line  @typescript-eslint/explicit-module-boundary-types
  public isBackgroundImmediateFireEvent(event: any): boolean {
    let rval: boolean = false;

    if (!!event) {
      if (LambdaEventDetector.isSingleSnsEvent(event)) {
        const cast: SNSEvent = event as SNSEvent;
        const msg: string = cast.Records[0].Sns.Message;
        if (!!StringRatchet.trimToNull(msg)) {
          const parsed: any = JSON.parse(msg);
          rval = !!parsed && parsed['type'] === EpsilonConstants.BACKGROUND_SNS_IMMEDIATE_RUN_FLAG;
        }
      }
    }
    return rval;
  }

  // eslint-disable-next-line  @typescript-eslint/explicit-module-boundary-types
  public parseImmediateFireBackgroundEntry(event: any): InternalBackgroundEntry<any> {
    let rval: InternalBackgroundEntry<any> = null;
    try {
      if (!!event) {
        if (LambdaEventDetector.isSingleSnsEvent(event)) {
          const cast: SNSEvent = event as SNSEvent;
          const msg: string = cast.Records[0].Sns.Message;
          if (!!StringRatchet.trimToNull(msg)) {
            const parsed: any = JSON.parse(msg);
            if (!!parsed && parsed['type'] === EpsilonConstants.BACKGROUND_SNS_IMMEDIATE_RUN_FLAG) {
              rval = parsed['backgroundEntry'];
            }
          }
        }
      }
    } catch (err) {
      Logger.error('Could not parse %j as an immediate run event : %s', event, err, err);
    }
    return rval;
  }

  public isBackgroundSqsMessage(message: AWS.SQS.Types.ReceiveMessageResult): boolean {
    let rval: boolean = false;
    if (message && message.Messages && message.Messages.length > 0) {
      const missingFlagField: any = message.Messages.find((se) => {
        try {
          const parsed: any = JSON.parse(se.Body);
          return !parsed[EpsilonConstants.BACKGROUND_SQS_TYPE_FIELD];
        } catch (err) {
          Logger.warn('Failed to parse message : %j %s', se, err);
          return true;
        }
      });
      if (missingFlagField) {
        Logger.silly('Found at least one message missing a type field');
      } else {
        rval = true;
      }
    }
    return rval;
  }

  // Either trigger a pull of the SQS queue, or process immediately
  // eslint-disable-next-line  @typescript-eslint/explicit-module-boundary-types
  public async processBackgroundSNSEvent(event: any, context: Context): Promise<number> {
    let rval: number = null;
    if (!this.isBackgroundStartSnsEvent(event)) {
      const backgroundEntry: InternalBackgroundEntry<any> = this.parseImmediateFireBackgroundEntry(event);
      if (!!backgroundEntry) {
        Logger.silly('Processing immediate fire event : %j', backgroundEntry);
        const result: boolean = await this.processSingleBackgroundEntry(backgroundEntry);
        rval = 1; // Process a single entry
      } else {
        Logger.warn('Tried to process non-background start / immediate event : %j returning false', event);
      }
    } else {
      rval = await this.takeAndProcessSingleBackgroundSQSMessage();
    }
    return rval;
  }

  private async takeEntryFromBackgroundQueue(): Promise<InternalBackgroundEntry<any>[]> {
    const rval: InternalBackgroundEntry<any>[] = [];

    const params = {
      MaxNumberOfMessages: 1,
      QueueUrl: this.cfg.aws.queueUrl,
      VisibilityTimeout: 300,
      WaitTimeSeconds: 0,
    };

    const message: AWS.SQS.ReceiveMessageResult = await this.mgr.sqs.receiveMessage(params).promise();
    if (message && message.Messages && message.Messages.length > 0) {
      for (let i = 0; i < message.Messages.length; i++) {
        const m: AWS.SQS.Message = message.Messages[i];
        try {
          const parsedBody: InternalBackgroundEntry<any> = JSON.parse(m.Body);
          if (!parsedBody.type) {
            Logger.warn('Dropping invalid background entry : %j', parsedBody);
          } else {
            rval.push(parsedBody);
          }

          Logger.debug('Removing message from queue');
          const delParams = {
            QueueUrl: this.cfg.aws.queueUrl,
            ReceiptHandle: m.ReceiptHandle,
          };
          const delResult: any = await this.mgr.sqs.deleteMessage(delParams).promise();
          Logger.silly('Delete result : %j', delResult);
        } catch (err) {
          Logger.warn('Error parsing message, dropping : %j', m);
        }
      }
    } else {
      Logger.debug('No messages found (likely end of recursion)');
    }

    return rval;
  }

  private async takeAndProcessSingleBackgroundSQSMessage(): Promise<number> {
    let rval: number = null;
    const entries: InternalBackgroundEntry<any>[] = await this.takeEntryFromBackgroundQueue();

    // Do them one at a time since Background is meant to throttle.  Also, it should really
    // only be one per pull anyway
    for (let i = 0; i < entries.length; i++) {
      const e: InternalBackgroundEntry<any> = entries[i];
      const result: boolean = await this.processSingleBackgroundEntry(e);
      rval += result ? 1 : 0;
    }

    return rval;
  }

  private async conditionallyStartTransactionLog(e: InternalBackgroundEntry<any>): Promise<void> {
    try {
      if (this.cfg.s3TransactionLoggingConfig) {
        if (!StringRatchet.trimToNull(e.guid)) {
          Logger.warn('No guid found - creating');
          e.guid = BackgroundManager.generateBackgroundGuid();

          const log: BackgroundTransactionLog = {
            request: e,
            running: true,
          };
          await this.s3TransactionLogCacheRatchet.writeObjectToCacheFile(
            BackgroundManager.backgroundGuidToPath(this.cfg.s3TransactionLoggingConfig.prefix, e.guid),
            log
          );
        }
        Logger.debug('Starting transaction log');
      }
    } catch (err) {
      Logger.error('Background : BAD - Failed to start transaction : %s', err, err);
    }
  }

  private async conditionallyCompleteTransactionLog(
    e: InternalBackgroundEntry<any>,
    result: any,
    error: any,
    runtimeMS: number
  ): Promise<void> {
    try {
      if (this.cfg.s3TransactionLoggingConfig) {
        if (!StringRatchet.trimToNull(e.guid)) {
          Logger.error('Background : BAD - should not happen - no guid found for %j', e);
        } else {
          Logger.debug('Completing transaction log');
          const log: BackgroundTransactionLog = {
            request: e,
            result: result,
            error: error ? ErrorRatchet.safeStringifyErr(error) : null,
            running: false,
            runtimeMS: runtimeMS,
          };
          await this.s3TransactionLogCacheRatchet.writeObjectToCacheFile(
            BackgroundManager.backgroundGuidToPath(this.cfg.s3TransactionLoggingConfig.prefix, e.guid),
            log
          );
        }
      }
    } catch (err) {
      Logger.error('Background : BAD - Failed to complete transaction : %s', err, err);
    }
  }

  private async conditionallyRunErrorProcessor(e: InternalBackgroundEntry<any>, error: any): Promise<void> {
    try {
      if (this.cfg.errorProcessor) {
        Logger.info('Running error processor');
        await this.cfg.errorProcessor.handleError(e, error);
      }
    } catch (err) {
      Logger.error('Background : BAD - Failed to run error processor : %s', err, err);
    }
  }

  // CAW 2020-08-08 : I am making processSingle public because there are times (such as when
  // using AWS batch) that you want to be able to run a background command directly, eg, from
  // the command line without needing an AWS-compliant event wrapping it. Thus, this.
  public async processSingleBackgroundEntry(e: InternalBackgroundEntry<any>): Promise<boolean> {
    Logger.info('Background Process Start: %j', e);
    const sw: StopWatch = new StopWatch(true);
    await this.conditionallyStartTransactionLog(e);
    let rval: boolean = false;
    try {
      const processorInput: BackgroundProcessor<any> = this.processors.get(e.type);
      if (!processorInput) {
        ErrorRatchet.throwFormattedErr('Found no processor for background entry : %j (returning false)', e);
      }
      let dataValidationErrors: string[] = [];
      if (StringRatchet.trimToNull(processorInput.dataSchemaName)) {
        // If it was submitted through HTTP this was checked on the API side, but if they used the
        // background manager directly (or direct-posted to SQS/SNS) that would have been bypassed.  We'll double
        // check here
        dataValidationErrors = this.modelValidator.validate(processorInput.dataSchemaName, e.data, false, false);
      }
      if (dataValidationErrors.length > 0) {
        ErrorRatchet.throwFormattedErr('Not processing, data failed validation; entry was %j : errors : %j', e, dataValidationErrors);
      } else {
        let result: any = await processorInput.handleEvent(e.data, this.mgr);
        result = result || 'SUCCESSFUL COMPLETION : NO RESULT RETURNED';
        await this.conditionallyCompleteTransactionLog(e, result, null, sw.elapsedMS());
        rval = true;
      }
    } catch (err) {
      Logger.error('Background Process Error: %j : %s', e, err, err);
      await this.conditionallyRunErrorProcessor(e, err);
      await this.conditionallyCompleteTransactionLog(e, null, err, sw.elapsedMS());
    }
    sw.stop();
    Logger.info('Background Process Stop: %j : %s', e, sw.dump());
    return rval;
  }

  // Returns a copy so you cannot modify the internal one here
  public getConfig(): BackgroundConfig {
    const rval: BackgroundConfig = Object.assign({}, this.cfg);
    return rval;
  }
}
