import { Context, ProxyResult } from 'aws-lambda';
import { Logger } from '@bitblit/ratchet/common/logger';
import { EventUtil } from './http/event-util';
import { BackgroundEntry } from './background/background-entry';
import { EpsilonInstance } from './epsilon-instance';
import { TimeoutToken } from '@bitblit/ratchet/common/timeout-token';
import { PromiseRatchet } from '@bitblit/ratchet/common/promise-ratchet';
import { ResponseUtil } from './http/response-util';
import { EpsilonHttpError } from './http/error/epsilon-http-error';
import { RequestTimeoutError } from './http/error/request-timeout-error';
import { InternalBackgroundEntry } from './background/internal-background-entry';
import {
  LoggerLevelName,
  LoggerOptions,
  LoggerOutputFunction,
  LogMessage,
  LogMessageFormatType,
  LogMessageProcessor,
} from '@bitblit/ratchet/common';
import { ContextUtil } from './util/context-util';
import { EpsilonLambdaEventHandler } from './config/epsilon-lambda-event-handler';
import { WebV2Handler } from './http/web-v2-handler';
import { InterApiEpsilonLambdaEventHandler } from './lambda-event-handler/inter-api-epsilon-lambda-event-handler';
import { GenericSnsEpsilonLambdaEventHandler } from './lambda-event-handler/generic-sns-epsilon-lambda-event-handler';
import { CronEpsilonLambdaEventHandler } from './lambda-event-handler/cron-epsilon-lambda-event-handler';
import { S3EpsilonLambdaEventHandler } from './lambda-event-handler/s3-epsilon-lambda-event-handler';
import { DynamoEpsilonLambdaEventHandler } from './lambda-event-handler/dynamo-epsilon-lambda-event-handler';
import { StringRatchet } from '@bitblit/ratchet/common/string-ratchet';
import { EpsilonLoggingExtensionProcessor } from './epsilon-logging-extension-processor';

/**
 * This class functions as the adapter from a default Lambda function to the handlers exposed via Epsilon
 */
export class EpsilonGlobalHandler {
  private static LOGGER_CONFIGURED: boolean = false;
  private static GLOBAL_INSTANCE_PROVIDER: () => Promise<EpsilonGlobalHandler>;

  public static set globalInstanceProvider(input: () => Promise<EpsilonGlobalHandler>) {
    EpsilonGlobalHandler.GLOBAL_INSTANCE_PROVIDER = input;
  }

  public static get globalInstanceProvider(): () => Promise<EpsilonGlobalHandler> {
    return EpsilonGlobalHandler.GLOBAL_INSTANCE_PROVIDER;
  }
  private handlers: EpsilonLambdaEventHandler<any>[] = null;

  constructor(private _epsilon: EpsilonInstance) {
    // We only want to do this if it wasn't explicitly configured earlier
    if (!EpsilonGlobalHandler.LOGGER_CONFIGURED) {
      EpsilonGlobalHandler.configureDefaultLogger();
      Logger.info('EpsilonLoggingConfiguration:Default logger configured');
    } else {
      Logger.info('EpsilonLoggingConfiguration:Skipping default logger config - already configured');
    }

    this.handlers = [
      this._epsilon.webHandler,
      new WebV2Handler(this._epsilon.webHandler),
      this._epsilon.backgroundHandler,
      new InterApiEpsilonLambdaEventHandler(this._epsilon),
      new GenericSnsEpsilonLambdaEventHandler(this._epsilon),
      new CronEpsilonLambdaEventHandler(this._epsilon),
      new S3EpsilonLambdaEventHandler(this._epsilon),
      new DynamoEpsilonLambdaEventHandler(this._epsilon),
    ];
  }

  public static configureDefaultLogger(overrides?: LoggerOptions): void {
    const output: LoggerOptions = overrides ? Object.assign({}, overrides) : {};
    output.initialLevel = output.initialLevel ?? LoggerLevelName.info;
    output.formatType = output.formatType ?? LogMessageFormatType.StructuredJson;
    //output.trace;
    output.globalVars = output.globalVars ?? {}; // No extra defaults for now
    output.outputFunction = output.outputFunction ?? LoggerOutputFunction.StdOut;
    output.ringBufferSize = output.ringBufferSize ?? 0;
    const src: LogMessageProcessor[] = output.preProcessors || [];
    output.preProcessors = src.concat([new EpsilonLoggingExtensionProcessor()]);
    //output.preProcessors.push();

    const pre: LoggerOptions = Logger.getOptions();
    Logger.changeDefaultOptions(output, true);
    const post: LoggerOptions = Logger.getOptions();
    EpsilonGlobalHandler.LOGGER_CONFIGURED = true;
    Logger.info('EpsilonLoggingConfiguration: Updated');
    Logger.dumpOptionsIntoLog();
  }

  public get epsilon(): EpsilonInstance {
    return this._epsilon;
  }

  public async processSingleBackgroundByParts<T>(
    type: string,
    data?: T,
    overrideTraceId?: string,
    overrideTraceDepth?: number
  ): Promise<boolean> {
    return this.processSingleBackgroundEntry(this._epsilon.backgroundManager.createEntry(type, data), overrideTraceId, overrideTraceDepth);
  }

  public async processSingleBackgroundEntry(
    e: BackgroundEntry<any>,
    overrideTraceId?: string,
    overrideTraceDepth?: number
  ): Promise<boolean> {
    let rval: boolean = false;
    if (e?.type) {
      const internal: InternalBackgroundEntry<any> = this._epsilon.backgroundManager.wrapEntryForInternal(
        e,
        overrideTraceId,
        overrideTraceDepth
      );
      rval = await this._epsilon.backgroundHandler.processSingleBackgroundEntry(internal);
      Logger.info('Direct processed request %j to %s', e, rval);
    } else {
      Logger.error('Cannot process null/unnamed background entry');
    }
    return rval;
  }

  public async lambdaHandler(event: any, context: Context): Promise<any> {
    let rval: any = null;
    try {
      if (this.epsilon.config.disableLastResortTimeout || !context || !context.getRemainingTimeInMillis()) {
        rval = await this.innerLambdaHandler(event, context);
      } else {
        // Outer wrap timeout makes sure that we timeout even if the slow part is a filter instead of the controller
        const tmp: any = await PromiseRatchet.timeout<ProxyResult>(
          this.innerLambdaHandler(event, context),
          'EpsilonLastResortTimeout',
          context.getRemainingTimeInMillis() - 1000
        ); // Reserve 1 second for cleanup
        if (TimeoutToken.isTimeoutToken(tmp)) {
          (tmp as TimeoutToken).writeToLog();
          // Using the HTTP version since it can use it, and the background ones dont care about the response format
          rval = ResponseUtil.errorResponse(EpsilonHttpError.wrapError(new RequestTimeoutError('Timed out')));
        } else {
          rval = tmp;
        }
      }
    } finally {
      ContextUtil.clearContext();
    }
    return rval;
  }

  public async innerLambdaHandler(event: any, context: Context): Promise<any> {
    ContextUtil.initContext(this._epsilon, event, context, 'TBD');
    let rval: ProxyResult = null;

    // By default, let's err on the safe side: unless we have confirmed our event handler
    // DOES exist and DOES NOT want uncaught errors raised, presume errors SHOULD be raised.
    //
    // This will ensure that if we catch an error before that point, and the Lambda function
    // is acting as an async event handler, the error will be raised, and Lambda will retry
    // those async events.
    let allowUncaughtErrors: boolean = true;

    try {
      if (!this._epsilon) {
        Logger.error('Config not found, abandoning');
        return false;
      }

      // Setup logging
      const logLevel: LoggerLevelName = EventUtil.calcLogLevelViaEventOrEnvParam(
        Logger.getLevel(),
        event,
        this._epsilon.config.loggerConfig
      );
      Logger.setLevel(logLevel);

      if (
        this._epsilon.config.loggerConfig &&
        this._epsilon.config.loggerConfig.queryParamTracePrefixName &&
        event.queryStringParameters &&
        event.queryStringParameters[this._epsilon.config.loggerConfig.queryParamTracePrefixName]
      ) {
        Logger.info('Setting trace prefix to %s', event.queryStringParameters[this._epsilon.config.loggerConfig.queryParamTracePrefixName]);
        Logger.updateTracePrefix(event.queryStringParameters[this._epsilon.config.loggerConfig.queryParamTracePrefixName]);
      }

      let found: boolean = false;
      for (let i = 0; i < this.handlers.length && !found; i++) {
        const handler: EpsilonLambdaEventHandler<any> = this.handlers[i];
        if (handler.handlesEvent(event)) {
          found = true;
          const label: string = handler.extractLabel(event, context);
          ContextUtil.setProcessLabel(label);
          Logger.logByLevel(
            this._epsilon?.config?.loggerConfig?.epsilonStartEndMessageLogLevel || LoggerLevelName.info,
            'EvtStart: %s',
            label
          );
          rval = await handler.processEvent(event, context);
          Logger.logByLevel(
            this._epsilon?.config?.loggerConfig?.epsilonStartEndMessageLogLevel || LoggerLevelName.info,
            'EvtEnd: %s',
            label
          );
          Logger.silly('EvtEnd:Value: %s Value: %j', label, rval);

          // Unless the handler specifically implements the `allowUncaughtErrors` method and it returns
          // true, presume it does NOT want uncaught errors thrown. This will result in uncaught errors
          // being wrapped in an HTTP 500 response.
          if (!(handler.hasOwnProperty('allowUncaughtErrors') && handler.allowUncaughtErrors())) {
            allowUncaughtErrors = false;
          }
        }
      }
    } catch (err) {
      if (allowUncaughtErrors) {
        throw err;
      }
      Logger.error('Error slipped out to outer edge.  Logging and returning false : %s', err, err);
      rval = {
        statusCode: 500,
        body: JSON.stringify({ error: StringRatchet.safeString(err) }),
        isBase64Encoded: false,
      };
    }
    return rval;
  }
}
