import AWS from 'aws-sdk';
import { Logger, ErrorRatchet, StringRatchet, StopWatch } from '@bitblit/ratchet/dist/common';
import { BackgroundEntry } from './background-entry';
import { Context, SNSEvent } from 'aws-lambda';
import { BackgroundConfig } from './background-config';
import { LambdaEventDetector } from '@bitblit/ratchet/dist/aws';
import { BackgroundConfigUtil } from './background-config-util';
import { EpsilonConstants } from '../epsilon-constants';
import { BackgroundProcessor } from './background-processor';
import { ModelValidator } from '../global/model-validator';

/**
 * We use a FIFO queue so that 2 different Lambdas don't both work on the same
 * thing at the same time.
 */
export class BackgroundHandler {
  private processors: Map<string, BackgroundProcessor<any, any>>;

  constructor(private cfg: BackgroundConfig, private modelValidator?: ModelValidator) {
    const cfgErrors: string[] = BackgroundConfigUtil.validateConfig(cfg);
    if (cfgErrors.length > 0) {
      ErrorRatchet.throwFormattedErr('Invalid background config : %j : %j', cfgErrors, cfg);
    }
    Logger.silly('Starting Background processor, %d processors', cfg.processors.length);
    this.processors = BackgroundConfigUtil.validateAndMapProcessors(cfg.processors, modelValidator);
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
  public parseImmediateFireBackgroundEntry(event: any): BackgroundEntry {
    let rval: BackgroundEntry = null;
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
      const backgroundEntry: BackgroundEntry = this.parseImmediateFireBackgroundEntry(event);
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

  private async takeEntryFromBackgroundQueue(): Promise<BackgroundEntry[]> {
    let rval: BackgroundEntry[] = [];

    if (BackgroundConfigUtil.awsConfig(this.cfg)) {
      const params = {
        MaxNumberOfMessages: 1,
        QueueUrl: this.cfg.aws.queueUrl,
        VisibilityTimeout: 300,
        WaitTimeSeconds: 0,
      };

      const message: AWS.SQS.ReceiveMessageResult = await this.cfg.aws.sqs.receiveMessage(params).promise();
      if (message && message.Messages && message.Messages.length > 0) {
        for (let i = 0; i < message.Messages.length; i++) {
          const m: AWS.SQS.Message = message.Messages[i];
          try {
            const parsedBody: BackgroundEntry = JSON.parse(m.Body);
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
            const delResult: any = await this.cfg.aws.sqs.deleteMessage(delParams).promise();
            Logger.silly('Delete result : %j', delResult);
          } catch (err) {
            Logger.warn('Error parsing message, dropping : %j', m);
          }
        }
      } else {
        Logger.debug('No messages found (likely end of recursion)');
      }
    } else {
      Logger.debug('Running local - no queue');
      rval = [];
    }

    return rval;
  }

  private async takeAndProcessSingleBackgroundSQSMessage(): Promise<number> {
    let rval: number = null;
    const entries: BackgroundEntry[] = await this.takeEntryFromBackgroundQueue();

    // Do them one at a time since Background is meant to throttle.  Also, it should really
    // only be one per pull anyway
    for (let i = 0; i < entries.length; i++) {
      const e: BackgroundEntry = entries[i];
      const result: boolean = await this.processSingleBackgroundEntry(e);
      rval += result ? 1 : 0;
    }

    return rval;
  }

  // CAW 2020-08-08 : I am making processSingle public because there are times (such as when
  // using AWS batch) that you want to be able to run a background command directly, eg, from
  // the command line without needing an AWS-compliant event wrapping it. Thus, this.
  public async processSingleBackgroundEntry(e: BackgroundEntry): Promise<boolean> {
    let rval: boolean = false;
    try {
      const processorInput: BackgroundProcessor<any, any> = this.processors.get(e.type);
      if (!processorInput) {
        Logger.warn('Found no processor for background entry : %j (returning false)', e);
      } else {
        const sw: StopWatch = new StopWatch(true);
        await processorInput.handleEvent(e.data, e.metadata, this.cfg);
        rval = true;
        sw.stop();
        Logger.info('Processed %j : %s', e, sw.dump());
      }
    } catch (err) {
      Logger.error('Failed while processing background entry (returning false): %j : %s', e, err, err);
    }
    return rval;
  }

  // Returns a copy so you cannot modify the internal one here
  public getConfig(): BackgroundConfig {
    const rval: BackgroundConfig = Object.assign({}, this.cfg);
    return rval;
  }
}
