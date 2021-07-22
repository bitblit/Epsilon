import { APIGatewayEvent, Context, DynamoDBStreamEvent, S3CreateEvent, S3Event, ScheduledEvent, SNSEvent } from 'aws-lambda';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { EpsilonConfig } from './global/epsilon-config';
import { WebHandler } from './http/web-handler';
import { LambdaEventDetector } from '@bitblit/ratchet/dist/aws/lambda-event-detector';
import { SnsHandlerFunction } from './non-http/sns-handler-function';
import { DynamoDbHandlerFunction } from './non-http/dynamo-db-handler-function';
import { S3CreateHandlerFunction } from './non-http/s3-create-handler-function';
import { S3RemoveHandlerFunction } from './non-http/s3-remove-handler-function';
import { EventUtil } from './http/event-util';
import { CronBackgroundEntry } from './background/cron/cron-background-entry';
import { CronUtil } from './background/cron/cron-util';
import { CronDirectEntry } from './background/cron/cron-direct-entry';
import { CronConfig } from './background/cron/cron-config';
import { BackgroundHandler } from './background/background-handler';
import { BackgroundConfig } from './background/background-config';
import { BackgroundEntry } from './background/background-entry';
import { BackgroundManager } from './background/background-manager';
import { EpsilonInstance } from './global/epsilon-instance';

/**
 * This class functions as the adapter from a default Lambda function to the handlers exposed via Epsilon
 */
export class EpsilonGlobalHandler {
  // This only really works because Node is single-threaded - otherwise need some kind of thread local
  public static CURRENT_CONTEXT: Context;

  constructor(private _epsilon: EpsilonInstance) {
    if (_epsilon.backgroundManager) {
      this.attachLocalBackgroundManager(_epsilon.backgroundManager);
    }
  }

  public get epsilon(): EpsilonInstance {
    return this.epsilon;
  }

  public attachLocalBackgroundManager(bm: BackgroundManager): void {
    Logger.info('Attaching local-mode background manager bus');
    bm.localBus().subscribe(async (evt) => {
      Logger.debug('Processing local background entry : %j', evt);
      const rval: boolean = await this._epsilon.backgroundHandler.processSingleBackgroundEntry(evt);
      Logger.info('Processor returned %s', rval);
    });
  }

  public async lambdaHandler(event: any, context: Context): Promise<any> {
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
      } else if (LambdaEventDetector.isValidSnsEvent(event)) {
        Logger.debug('Epsilon: SNS: %j', event);
        // If background processing is here, it takes precedence
        const sm: BackgroundHandler = this._epsilon.backgroundHandler;
        if (sm && sm.isBackgroundSNSEvent(event)) {
          const procd: number = await sm.processBackgroundSNSEvent(event, context);
          rval = procd;
          if (procd > 0) {
            Logger.info('Processed %d entries - refiring');
            await this._epsilon.backgroundManager.fireStartProcessingRequest();
          } else {
            Logger.info('Queue is now empty, stopping');
          }
        } else {
          rval = await this.processSnsEvent(event as SNSEvent);
        }
      } else if (LambdaEventDetector.isValidS3Event(event)) {
        Logger.debug('Epsilon: S3: %j', event);

        rval = await this.processS3Event(event as S3CreateEvent);
      } else if (LambdaEventDetector.isValidCronEvent(event)) {
        Logger.debug('Epsilon: CRON: %j', event);
        if (this._epsilon.config.disabled.cron) {
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
    if (this._epsilon.config && this._epsilon.config.sns && !this._epsilon.config.disabled.sns && evt && evt.Records.length > 0) {
      const finder: string = evt.Records[0].Sns.TopicArn;
      const handler: SnsHandlerFunction = this.findInMap<SnsHandlerFunction>(finder, this._epsilon.config.sns.handlers);
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
    if (this._epsilon.config && this._epsilon.config.s3 && !this._epsilon.config.disabled.s3 && evt && evt.Records.length > 0) {
      const finder: string = evt.Records[0].s3.bucket.name + '/' + evt.Records[0].s3.object.key;
      const isRemoveEvent: boolean = evt.Records[0].eventName && evt.Records[0].eventName.startsWith('ObjectRemoved');

      if (isRemoveEvent) {
        const handler: S3RemoveHandlerFunction = this.findInMap<S3RemoveHandlerFunction>(finder, this._epsilon.config.s3.removeHandlers);
        if (handler) {
          rval = await handler(evt);
        } else {
          Logger.info('Found no s3 create handler for : %s', finder);
        }
      } else {
        const handler: S3CreateHandlerFunction = this.findInMap<S3CreateHandlerFunction>(finder, this._epsilon.config.s3.createHandlers);
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
      if (!!cronConfig.backgroundEntries) {
        if (!!background) {
          const backgroundConfig: BackgroundConfig = background.getConfig();
          const toEnqueue: BackgroundEntry[] = [];
          for (let i = 0; i < cronConfig.backgroundEntries.length; i++) {
            const smCronEntry: CronBackgroundEntry = cronConfig.backgroundEntries[i];
            if (CronUtil.eventMatchesEntry(evt, smCronEntry, cronConfig)) {
              Logger.info('Firing Background cron : %s', CronUtil.cronEntryName(smCronEntry));

              const metadata: any = Object.assign(
                {},
                EpsilonGlobalHandler.resolvePotentialFunctionToResult<any>(smCronEntry.metadata, {}),
                {
                  cronDelegate: true,
                  cronSourceEvent: evt,
                }
              );

              const backgroundEntry: BackgroundEntry = {
                type: smCronEntry.backgroundTaskType,
                created: new Date().getTime(),
                data: EpsilonGlobalHandler.resolvePotentialFunctionToResult<any>(smCronEntry.data, {}),
                metadata: metadata,
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
      if (!!cronConfig.directEntries) {
        for (let i = 0; i < cronConfig.directEntries.length; i++) {
          const directEntry: CronDirectEntry = cronConfig.directEntries[i];
          if (CronUtil.eventMatchesEntry(evt, directEntry, cronConfig)) {
            Logger.info('Firing direct cron : %s', CronUtil.cronEntryName(directEntry, i));
            await directEntry.directHandler(evt);
            rval = true;
          }
        }
      }
    }
    return rval;
  }

  private async processDynamoDbEvent(evt: DynamoDBStreamEvent): Promise<any> {
    let rval: any = null;
    if (
      this._epsilon.config &&
      this._epsilon.config.dynamoDb &&
      !this._epsilon.config.disabled.dynamoDb &&
      evt &&
      evt.Records &&
      evt.Records.length > 0
    ) {
      const finder: string = evt.Records[0].eventSourceARN;
      const handler: DynamoDbHandlerFunction = this.findInMap<DynamoDbHandlerFunction>(finder, this._epsilon.config.dynamoDb.handlers);
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
