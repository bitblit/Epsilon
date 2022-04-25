import {
  APIGatewayEvent,
  APIGatewayProxyEventV2,
  Context,
  DynamoDBStreamEvent,
  ProxyResult,
  S3CreateEvent,
  S3Event,
  ScheduledEvent,
  SNSEvent,
} from 'aws-lambda';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { WebHandler } from './http/web-handler';
import { LambdaEventDetector } from '@bitblit/ratchet/dist/aws/lambda-event-detector';
import { EventUtil } from './http/event-util';
import { BackgroundHandler } from './background/background-handler';
import { BackgroundEntry } from './background/background-entry';
import { BackgroundManager } from './background-manager';
import { EpsilonInstance } from './epsilon-instance';
import { CronConfig } from './config/cron/cron-config';
import { CronBackgroundEntry } from './config/cron/cron-background-entry';
import { CronUtil } from './util/cron-util';
import { GenericAwsEventHandlerFunction } from './config/generic-aws-event-handler-function';
import { TimeoutToken } from '@bitblit/ratchet/dist/common/timeout-token';
import { PromiseRatchet } from '@bitblit/ratchet/dist/common/promise-ratchet';
import { ResponseUtil } from './http/response-util';
import { EpsilonHttpError } from './http/error/epsilon-http-error';
import { RequestTimeoutError } from './http/error/request-timeout-error';
import { InternalBackgroundEntry } from './background/internal-background-entry';
import { InterApiUtil } from './inter-api/inter-api-util';

/**
 * This class functions as the adapter from a default Lambda function to the handlers exposed via Epsilon
 */
export class EpsilonGlobalHandler {
  // This only really works because Node is single-threaded - otherwise need some kind of thread local
  public static CURRENT_CONTEXT: Context;

  constructor(private _epsilon: EpsilonInstance) {}

  public get epsilon(): EpsilonInstance {
    return this._epsilon;
  }

  public async processSingleBackgroundByParts<T>(type: string, data?: T): Promise<boolean> {
    return this.processSingleBackgroundEntry(this._epsilon.backgroundManager.createEntry(type, data));
  }

  public async processSingleBackgroundEntry(e: BackgroundEntry<any>): Promise<boolean> {
    let rval: boolean = false;
    if (e?.type) {
      const internal: InternalBackgroundEntry<any> = this._epsilon.backgroundManager.wrapEntryForInternal(e);
      rval = await this._epsilon.backgroundHandler.processSingleBackgroundEntry(internal);
      Logger.info('Direct processed request %j to %s', e, rval);
    } else {
      Logger.error('Cannot process null/unnamed background entry');
    }
    return rval;
  }

  public async lambdaHandler(event: any, context: Context): Promise<any> {
    let rval: any = null;
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
    return rval;
  }

  public async innerLambdaHandler(event: any, context: Context): Promise<any> {
    EpsilonGlobalHandler.CURRENT_CONTEXT = context;
    let rval: any = null;
    try {
      if (!this._epsilon) {
        Logger.error('Config not found, abandoning');
        return false;
      }

      // Setup logging
      const logLevel: string = EventUtil.calcLogLevelViaEventOrEnvParam(Logger.getLevel(), event, this._epsilon.config.loggerConfig);
      Logger.setLevelByName(logLevel);

      if (
        this._epsilon.config.loggerConfig &&
        this._epsilon.config.loggerConfig.queryParamTracePrefixName &&
        event.queryStringParameters &&
        event.queryStringParameters[this._epsilon.config.loggerConfig.queryParamTracePrefixName]
      ) {
        Logger.info('Setting trace prefix to %s', event.queryStringParameters[this._epsilon.config.loggerConfig.queryParamTracePrefixName]);
        Logger.setTracePrefix(event.queryStringParameters[this._epsilon.config.loggerConfig.queryParamTracePrefixName]);
      }

      if (LambdaEventDetector.isValidApiGatewayEvent(event)) {
        Logger.debug('Epsilon: APIG: %j', event);
        const wh: WebHandler = this._epsilon.webHandler;
        if (wh) {
          rval = await wh.lambdaHandler(event as APIGatewayEvent, context);
        } else {
          Logger.warn('ALB / API Gateway event, but no handler or disabled');
        }
      } else if (LambdaEventDetector.isValidApiGatewayV2WithRequestContextEvent(event)) {
        Logger.debug('Epsilon: APIGV2: %j', event);
        const wh: WebHandler = this._epsilon.webHandler;
        if (wh) {
          rval = await wh.v2LambdaHandler(event as APIGatewayProxyEventV2, context);
        } else {
          Logger.warn('ALB / API Gateway V2 event, but no handler or disabled');
        }
      } else if (LambdaEventDetector.isValidSnsEvent(event)) {
        Logger.debug('Epsilon: SNS: %j', event);
        // If background processing is here, it takes precedence
        const sm: BackgroundHandler = this._epsilon.backgroundHandler;
        if (sm && sm.isBackgroundSNSEvent(event)) {
          const procd: number = await sm.processBackgroundSNSEvent(event, context);
          rval = procd;
          if (procd > 0) {
            Logger.info('Processed %d entries - re-firing', procd);
            await this._epsilon.backgroundManager.fireStartProcessingRequest();
          } else {
            Logger.info('Queue is now empty, stopping');
          }
        } else if (this._epsilon.config.interApiConfig && InterApiUtil.isInterApiSnsEvent(event)) {
          rval = await InterApiUtil.processInterApiEvent(event, this._epsilon.config.interApiConfig, this._epsilon.backgroundManager);
        } else {
          rval = await this.processSnsEvent(event as SNSEvent);
        }
      } else if (LambdaEventDetector.isValidS3Event(event)) {
        Logger.debug('Epsilon: S3: %j', event);

        rval = await this.processS3Event(event as S3CreateEvent);
      } else if (LambdaEventDetector.isValidCronEvent(event)) {
        Logger.debug('Epsilon: CRON: %j', event);
        if (!this._epsilon.config.cron) {
          Logger.debug('Skipping - CRON disabled');
        } else {
          rval = await EpsilonGlobalHandler.processCronEvent(
            event as ScheduledEvent,
            this._epsilon.config.cron,
            this._epsilon.backgroundManager,
            this._epsilon.backgroundHandler
          );
        }
      } else if (LambdaEventDetector.isValidDynamoDBEvent(event)) {
        Logger.debug('Epsilon: DDB: %j', event);

        rval = await this.processDynamoDbEvent(event as DynamoDBStreamEvent);
      } else {
        Logger.warn('Unrecognized event, returning false : %j', event);
      }
    } catch (err) {
      Logger.error('Error slipped out to outer edge.  Logging and returning false : %s', err, err);
      rval = false;
    } finally {
      EpsilonGlobalHandler.CURRENT_CONTEXT = null;
    }

    return rval;
  }

  private async processSnsEvent(evt: SNSEvent): Promise<any> {
    let rval: any = null;
    if (this._epsilon.config && this._epsilon.config.sns && evt && evt.Records.length > 0) {
      const finder: string = evt.Records[0].Sns.TopicArn;
      const handler: GenericAwsEventHandlerFunction<SNSEvent> = this.findInMap<GenericAwsEventHandlerFunction<SNSEvent>>(
        finder,
        this._epsilon.config.sns.handlers
      );
      if (handler) {
        rval = await handler(evt);
      } else {
        Logger.info('Found no SNS handler for : %s', finder);
      }
    }
    return rval;
  }

  private async processS3Event(evt: S3Event): Promise<any> {
    let rval: any = null;
    if (this._epsilon.config && this._epsilon.config.s3 && evt && evt.Records.length > 0) {
      const finder: string = evt.Records[0].s3.bucket.name + '/' + evt.Records[0].s3.object.key;
      const isRemoveEvent: boolean = evt.Records[0].eventName && evt.Records[0].eventName.startsWith('ObjectRemoved');

      if (isRemoveEvent) {
        const handler: GenericAwsEventHandlerFunction<S3Event> = this.findInMap<GenericAwsEventHandlerFunction<S3Event>>(
          finder,
          this._epsilon.config.s3.removeHandlers
        );
        if (handler) {
          rval = await handler(evt);
        } else {
          Logger.info('Found no s3 create handler for : %s', finder);
        }
      } else {
        const handler: GenericAwsEventHandlerFunction<S3Event> = this.findInMap<GenericAwsEventHandlerFunction<S3Event>>(
          finder,
          this._epsilon.config.s3.createHandlers
        );
        if (handler) {
          rval = await handler(evt);
        } else {
          Logger.info('Found no s3 remove handler for : %s', finder);
        }
      }
    }
    return rval;
  }

  // Returns either the value if non-function, the result if function, and default if neither
  public static resolvePotentialFunctionToResult<T>(src: any, def: T): T {
    let rval: T = def;
    if (src) {
      if (typeof src === 'function') {
        rval = src();
      } else {
        rval = src;
      }
    }
    return rval;
  }

  public static async processCronEvent(
    evt: ScheduledEvent,
    cronConfig: CronConfig,
    backgroundManager: BackgroundManager,
    background: BackgroundHandler
  ): Promise<boolean> {
    let rval: boolean = false;
    if (cronConfig && evt && evt.resources[0]) {
      // Run all the background ones
      if (!!cronConfig.entries) {
        if (!!background) {
          const toEnqueue: BackgroundEntry<any>[] = [];
          for (let i = 0; i < cronConfig.entries.length; i++) {
            const smCronEntry: CronBackgroundEntry = cronConfig.entries[i];
            if (CronUtil.eventMatchesEntry(evt, smCronEntry, cronConfig)) {
              Logger.info('CRON Firing : %s', CronUtil.cronEntryName(smCronEntry));

              const backgroundEntry: BackgroundEntry<any> = {
                type: smCronEntry.backgroundTaskType,
                data: EpsilonGlobalHandler.resolvePotentialFunctionToResult<any>(smCronEntry.data, {}),
              };
              Logger.silly('Resolved entry : %j', backgroundEntry);
              if (smCronEntry.fireImmediate) {
                await backgroundManager.fireImmediateProcessRequest(backgroundEntry);
                rval = true;
              } else {
                toEnqueue.push(backgroundEntry);
              }
            }
          }
          if (toEnqueue.length > 0) {
            await backgroundManager.addEntriesToQueue(toEnqueue, true);
            rval = true;
          }
        } else {
          Logger.warn('Cron defines background tasks, but no background manager provided');
        }
      }
    }
    return rval;
  }

  private async processDynamoDbEvent(evt: DynamoDBStreamEvent): Promise<any> {
    let rval: any = null;
    if (this._epsilon.config && this._epsilon.config.dynamoDb && evt && evt.Records && evt.Records.length > 0) {
      const finder: string = evt.Records[0].eventSourceARN;
      const handler: GenericAwsEventHandlerFunction<DynamoDBStreamEvent> = this.findInMap<
        GenericAwsEventHandlerFunction<DynamoDBStreamEvent>
      >(finder, this._epsilon.config.dynamoDb.handlers);
      if (handler) {
        rval = await handler(evt);
      } else {
        Logger.info('Found no Dynamo handler for : %s', finder);
      }
    }
    return rval;
  }

  private findInMap<T>(toFind: string, map: Map<string, T>): T {
    let rval: T = null;
    map.forEach((val, key) => {
      if (this.matchExact(key, toFind)) {
        rval = val;
      }
    });
    return rval;
  }

  private matchExact(r, str) {
    const match = str.match(r);
    return match != null && str == match[0];
  }
}
