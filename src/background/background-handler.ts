import { Context, ProxyResult, SNSEvent } from 'aws-lambda';
import { EpsilonConstants } from '../epsilon-constants';
import { BackgroundValidator } from './background-validator';
import { BackgroundConfig } from '../config/background/background-config';
import { BackgroundProcessor } from '../config/background/background-processor';
import { InternalBackgroundEntry } from './internal-background-entry';
import { BackgroundTransactionLog } from '../config/background/background-transaction-log';
import { BackgroundExecutionEvent } from './background-execution-event';
import { BackgroundExecutionListener } from './background-execution-listener';
import { BackgroundExecutionEventType } from './background-execution-event-type';
import { EpsilonLambdaEventHandler } from '../config/epsilon-lambda-event-handler';
import { ContextUtil } from '../util/context-util';
import { BackgroundManagerLike } from './manager/background-manager-like';
import { AbstractBackgroundManager } from './manager/abstract-background-manager';
import { ErrorRatchet, Logger, StopWatch, StringRatchet } from '@bitblit/ratchet/common';
import { ModelValidator } from '@bitblit/ratchet/model-validator';
import { LambdaEventDetector } from '@bitblit/ratchet/aws';

/**
 * We use a FIFO queue so that 2 different Lambdas don't both work on the same
 * thing at the same time.
 */
export class BackgroundHandler implements EpsilonLambdaEventHandler<SNSEvent> {
  private processors: Map<string, BackgroundProcessor<any>>;
  private validator: BackgroundValidator;

  constructor(
    private cfg: BackgroundConfig,
    private mgr: BackgroundManagerLike,
    private modelValidator?: ModelValidator,
  ) {
    const cfgErrors: string[] = BackgroundValidator.validateConfig(cfg);
    if (cfgErrors.length > 0) {
      ErrorRatchet.throwFormattedErr('Invalid background config : %j', cfgErrors);
    }
    Logger.silly('Starting Background processor, %d processors', cfg.processors.length);
    this.validator = new BackgroundValidator(cfg, modelValidator);
    this.processors = BackgroundValidator.validateAndMapProcessors(cfg.processors, modelValidator);

    // If there is an immediate processing queue, wire me up to use it
    if (mgr?.immediateProcessQueue && mgr.immediateProcessQueue()) {
      Logger.info('Attaching to immediate processing queue');
      mgr.immediateProcessQueue().subscribe(async (evt) => {
        Logger.debug('Processing local background entry : %j', evt);
        const rval: boolean = await this.processSingleBackgroundEntry(evt);
        Logger.info('Processor returned %s', rval);
      });
    }
  }

  public extractLabel(evt: SNSEvent, context: Context): string {
    let rval: string = null;
    if (this.isBackgroundStartSnsEvent(evt)) {
      rval = 'BG:START-EVT';
    } else if (this.isBackgroundImmediateFireEvent(evt)) {
      const pEvt: InternalBackgroundEntry<any> = this.parseImmediateFireBackgroundEntry(evt);
      rval = 'BG:' + pEvt.type + ':' + pEvt.guid;
    } else {
      rval = 'BG:UNKNOWN';
    }
    return rval;
  }

  public handlesEvent(evt: any): boolean {
    return LambdaEventDetector.isValidSnsEvent(evt) && this.isBackgroundSNSEvent(evt);
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

  /*
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

   */

  // Either trigger a pull of the SQS queue, or process immediately
  // eslint-disable-next-line  @typescript-eslint/explicit-module-boundary-types
  public async processEvent(event: any, context: Context): Promise<ProxyResult> {
    let procd: number = null;
    if (!this.isBackgroundStartSnsEvent(event)) {
      const backgroundEntry: InternalBackgroundEntry<any> = this.parseImmediateFireBackgroundEntry(event);
      if (!!backgroundEntry) {
        Logger.silly('Processing immediate fire event : %j', backgroundEntry);
        const result: boolean = await this.processSingleBackgroundEntry(backgroundEntry);
        procd = 1; // Process a single entry
      } else {
        Logger.warn('Tried to process non-background start / immediate event : %j returning false', event);
      }
    } else {
      Logger.info('Reading task from background queue');
      procd = await this.takeAndProcessSingleBackgroundQueueEntry();
      if (procd > 0) {
        Logger.info('Processed %d elements from background queue, refiring', procd);
        const refire: string = await this.mgr.fireStartProcessingRequest();
        Logger.info('Refire returned %s', refire);
      } else {
        Logger.info('No items processed - stopping');
      }
    }

    const rval: ProxyResult = {
      statusCode: 200,
      body: StringRatchet.safeString(procd),
      isBase64Encoded: false,
    };

    return rval;
  }

  private async takeAndProcessSingleBackgroundQueueEntry(): Promise<number> {
    let rval: number = null;
    const entries: InternalBackgroundEntry<any>[] = await this.mgr.takeEntryFromBackgroundQueue();

    // Do them one at a time since Background is meant to throttle.  Also, it should really
    // only be one per pull anyway
    Logger.info('Found %d entries - processing', entries.length);
    for (let i = 0; i < entries.length; i++) {
      const e: InternalBackgroundEntry<any> = entries[i];
      const result: boolean = await this.processSingleBackgroundEntry(e);
      rval += result ? 1 : 0;
    }
    Logger.debug('Returning %d', rval);

    return rval;
  }

  private async safeWriteToLogger(entry: BackgroundTransactionLog): Promise<void> {
    if (this.cfg.transactionLogger) {
      try {
        await this.cfg.transactionLogger.logTransaction(entry);
      } catch (err) {
        Logger.error('Failed to write to transaction logger : %j : %s', entry, err, err);
      }
    } else {
      Logger.silly('Skipping - no logger defined');
    }
  }

  private async conditionallyStartTransactionLog(e: InternalBackgroundEntry<any>): Promise<void> {
    if (!StringRatchet.trimToNull(e.guid)) {
      Logger.warn('No guid found - creating');
      e.guid = AbstractBackgroundManager.generateBackgroundGuid();

      const log: BackgroundTransactionLog = {
        request: e,
        running: true,
      };
      await this.safeWriteToLogger(log);
    }
    Logger.debug('Starting transaction log');
  }

  private async conditionallyCompleteTransactionLog(
    e: InternalBackgroundEntry<any>,
    result: any,
    error: any,
    runtimeMS: number,
  ): Promise<void> {
    Logger.debug('Completing transaction log');
    const log: BackgroundTransactionLog = {
      request: e,
      result: result,
      error: error ? ErrorRatchet.safeStringifyErr(error) : null,
      running: false,
      runtimeMS: runtimeMS,
    };
    await this.safeWriteToLogger(log);
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

  private async fireListenerEvent(event: BackgroundExecutionEvent<any>) {
    const listeners: BackgroundExecutionListener<any>[] = this.cfg.executionListeners || [];
    for (const listener of listeners) {
      try {
        await listener.onEvent(event);
      } catch (err) {
        Logger.error('Failure triggering handler %s : %s', StringRatchet.trimToNull(listener?.label) || 'No-name', err);
      }
    }
  }

  // CAW 2020-08-08 : I am making processSingle public because there are times (such as when
  // using AWS batch) that you want to be able to run a background command directly, eg, from
  // the command line without needing an AWS-compliant event wrapping it. Thus, this.
  public async processSingleBackgroundEntry(e: InternalBackgroundEntry<any>): Promise<boolean> {
    // Set the trace ids appropriately
    ContextUtil.setOverrideTraceFromInternalBackgroundEntry(e);
    Logger.info('Background Process Start: %j', e);
    const sw: StopWatch = new StopWatch();
    await this.conditionallyStartTransactionLog(e);
    await this.mgr.populateInternalEntry(e);
    let rval: boolean = false;
    try {
      await this.fireListenerEvent({
        type: BackgroundExecutionEventType.ProcessStarting,
        processorType: e.type,
        data: e.data,
        guid: e.guid,
      });

      const processorInput: BackgroundProcessor<any> = this.processors.get(e.type);
      if (!processorInput) {
        ErrorRatchet.throwFormattedErr('Found no processor for background entry : %j (returning false)', e);
        await this.fireListenerEvent({
          type: BackgroundExecutionEventType.NoMatchProcessorName,
          processorType: e.type,
          data: e.data,
          guid: e.guid,
        });
      }

      let dataValidationErrors: string[] = [];
      if (StringRatchet.trimToNull(processorInput.dataSchemaName)) {
        // If it was submitted through HTTP this was checked on the API side, but if they used the
        // background manager directly (or direct-posted to SQS/SNS) that would have been bypassed.  We'll double
        // check here
        dataValidationErrors = this.modelValidator.validate(processorInput.dataSchemaName, e.data, false, false);
      }
      if (dataValidationErrors.length > 0) {
        await this.fireListenerEvent({
          type: BackgroundExecutionEventType.DataValidationError,
          processorType: e.type,
          data: e.data,
          errors: dataValidationErrors,
          guid: e.guid,
        });
        ErrorRatchet.throwFormattedErr('Not processing, data failed validation; entry was %j : errors : %j', e, dataValidationErrors);
      } else {
        let result: any = await processorInput.handleEvent(e.data, this.mgr);
        result = result || 'SUCCESSFUL COMPLETION : NO RESULT RETURNED';
        await this.conditionallyCompleteTransactionLog(e, result, null, sw.elapsedMS());
        await this.fireListenerEvent({
          type: BackgroundExecutionEventType.ExecutionSuccessfullyComplete,
          processorType: e.type,
          data: result,
          guid: e.guid,
        });
        rval = true;
      }
    } catch (err) {
      Logger.error('Background Process Error: %j : %s', e, err, err);
      await this.conditionallyRunErrorProcessor(e, err);
      await this.conditionallyCompleteTransactionLog(e, null, err, sw.elapsedMS());
      await this.fireListenerEvent({
        type: BackgroundExecutionEventType.ExecutionFailedError,
        processorType: e.type,
        data: e.data,
        errors: [ErrorRatchet.safeStringifyErr(err)],
        guid: e.guid,
      });
    }
    Logger.info('Background Process Stop: %j : %s', e, sw.dump());
    return rval;
  }

  // Returns a copy so you cannot modify the internal one here
  public getConfig(): BackgroundConfig {
    const rval: BackgroundConfig = Object.assign({}, this.cfg);
    return rval;
  }
}
