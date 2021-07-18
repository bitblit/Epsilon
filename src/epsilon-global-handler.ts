import { APIGatewayEvent, Context, DynamoDBStreamEvent, S3CreateEvent, S3Event, ScheduledEvent, SNSEvent } from 'aws-lambda';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { EpsilonConfig } from './global/epsilon-config';
import { WebHandler } from './http/web-handler';
import { LambdaEventDetector } from '@bitblit/ratchet/dist/aws/lambda-event-detector';
import { EpsilonDisableSwitches } from './global/epsilon-disable-switches';
import { SnsHandlerFunction } from './batch/sns-handler-function';
import { DynamoDbHandlerFunction } from './batch/dynamo-db-handler-function';
import { S3CreateHandlerFunction } from './batch/s3-create-handler-function';
import { S3RemoveHandlerFunction } from './batch/s3-remove-handler-function';
import { EventUtil } from './http/event-util';
import { CronSaltMineEntry } from './batch/cron/cron-salt-mine-entry';
import { CronUtil } from './batch/cron/cron-util';
import { CronDirectEntry } from './batch/cron/cron-direct-entry';
import { ErrorRatchet } from '@bitblit/ratchet/dist/common/error-ratchet';
import { CronConfig } from './batch/cron/cron-config';
import { SaltMineHandler } from './salt-mine/salt-mine-handler';
import { SaltMineConfig } from './salt-mine/salt-mine-config';
import { SaltMineEntry } from './salt-mine/salt-mine-entry';
import { SaltMineQueueManager } from './salt-mine/salt-mine-queue-util';
import { EpsilonRouter } from './http/route/epsilon-router';
import { RouterUtil } from './http/route/router-util';
import { LocalSaltMineQueueManager } from './salt-mine/local-salt-mine-queue-manager';
import { RemoteSaltMineQueueManager } from './salt-mine/remote-salt-mine-queue-manager';
import { SaltMineConfigUtil } from './salt-mine/salt-mine-config-util';

/**
 * This class functions as the adapter from a default Lambda function to the handlers exposed via Epsilon
 */
export class EpsilonGlobalHandler {
  private cacheWebHandler: WebHandler;
  private cacheSaltMineHandler: SaltMineHandler;
  private cacheEpsilonRouter: EpsilonRouter;
  private backgroundManager: SaltMineQueueManager;
  // This only really works because Node is single-threaded - otherwise need some kind of thread local
  public static CURRENT_CONTEXT: Context;

  constructor(private config: EpsilonConfig, localMode?: boolean) {
    this.validateGlobalConfig(config);
    if (!config.disabled) {
      config.disabled = {} as EpsilonDisableSwitches;
    }
    if (localMode) {
      Logger.info('Local mode specified, using local queue manager');
      this.backgroundManager = new LocalSaltMineQueueManager(
        SaltMineConfigUtil.processNames(this.config.saltMineConfig),
        this.fetchSaltMineHandler()
      );
    } else {
      this.backgroundManager = new RemoteSaltMineQueueManager(
        this.config.saltMineConfig.aws,
        SaltMineConfigUtil.processNames(this.config.saltMineConfig)
      );
    }
  }

  private validateGlobalConfig(config: EpsilonConfig) {
    if (!config) {
      ErrorRatchet.throwFormattedErr('Config may not be null');
    }
    if (!!config.cron && !config.cron.timezone) {
      ErrorRatchet.throwFormattedErr('Cron is defined, but timezone is not set');
    }
  }

  private fetchSaltMineHandler(): SaltMineHandler {
    if (!this.cacheSaltMineHandler) {
      if (!this.config.disabled.saltMine && this.config.saltMineConfig) {
        const router: EpsilonRouter = this.fetchEpsilonRouter();
        this.cacheSaltMineHandler = new SaltMineHandler(this.config.saltMineConfig, router.openApiModelValidator);
      }
    }
    return this.cacheSaltMineHandler;
  }

  private fetchEpsilonRouter(): EpsilonRouter {
    if (!this.cacheEpsilonRouter) {
      this.cacheEpsilonRouter = RouterUtil.openApiYamlToRouterConfig(this.config.openApiYamlString, this.config.httpConfig);
    }
    return this.cacheEpsilonRouter;
  }

  private fetchWebHandler(): WebHandler {
    if (!this.cacheWebHandler) {
      if (!this.config.disabled.http) {
        const router: EpsilonRouter = this.fetchEpsilonRouter();
        this.cacheWebHandler = new WebHandler(router);
      }
    }
    return this.cacheWebHandler;
  }

  public async lambdaHandler(event: any, context: Context): Promise<any> {
    EpsilonGlobalHandler.CURRENT_CONTEXT = context;
    let rval: any = null;
    try {
      if (!this.config) {
        Logger.error('Config not found, abandoning');
        return false;
      }

      // Setup logging
      const logLevel: string = EventUtil.calcLogLevelViaEventOrEnvParam(Logger.getLevel(), event, this.config.loggerConfig);
      Logger.setLevelByName(logLevel);

      if (
        this.config.loggerConfig &&
        this.config.loggerConfig.queryParamTracePrefixName &&
        event.queryStringParameters &&
        event.queryStringParameters[this.config.loggerConfig.queryParamTracePrefixName]
      ) {
        Logger.info('Setting trace prefix to %s', event.queryStringParameters[this.config.loggerConfig.queryParamTracePrefixName]);
        Logger.setTracePrefix(event.queryStringParameters[this.config.loggerConfig.queryParamTracePrefixName]);
      }

      if (LambdaEventDetector.isValidApiGatewayEvent(event)) {
        Logger.debug('Epsilon: APIG: %j', event);
        const wh: WebHandler = this.fetchWebHandler();
        if (wh) {
          rval = await wh.lambdaHandler(event as APIGatewayEvent, context);
        } else {
          Logger.warn('ALB / API Gateway event, but no handler or disabled');
        }
      } else if (LambdaEventDetector.isValidSnsEvent(event)) {
        Logger.debug('Epsilon: SNS: %j', event);
        // If salt mine is here, it takes precedence
        const sm: SaltMineHandler = this.fetchSaltMineHandler();
        if (sm && sm.isSaltMineSNSEvent(event)) {
          rval = await sm.processSaltMineSNSEvent(event, context);
        } else {
          rval = await this.processSnsEvent(event as SNSEvent);
        }
      } else if (LambdaEventDetector.isValidS3Event(event)) {
        Logger.debug('Epsilon: S3: %j', event);

        rval = await this.processS3Event(event as S3CreateEvent);
      } else if (LambdaEventDetector.isValidCronEvent(event)) {
        Logger.debug('Epsilon: CRON: %j', event);
        if (this.config.disabled.cron) {
          Logger.debug('Skipping - CRON disabled');
        } else {
          rval = await EpsilonGlobalHandler.processCronEvent(event as ScheduledEvent, this.config.cron, this.fetchSaltMineHandler());
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
    if (this.config && this.config.sns && !this.config.disabled.sns && evt && evt.Records.length > 0) {
      const finder: string = evt.Records[0].Sns.TopicArn;
      const handler: SnsHandlerFunction = this.findInMap<SnsHandlerFunction>(finder, this.config.sns.handlers);
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
    if (this.config && this.config.s3 && !this.config.disabled.s3 && evt && evt.Records.length > 0) {
      const finder: string = evt.Records[0].s3.bucket.name + '/' + evt.Records[0].s3.object.key;
      const isRemoveEvent: boolean = evt.Records[0].eventName && evt.Records[0].eventName.startsWith('ObjectRemoved');

      if (isRemoveEvent) {
        const handler: S3RemoveHandlerFunction = this.findInMap<S3RemoveHandlerFunction>(finder, this.config.s3.removeHandlers);
        if (handler) {
          rval = await handler(evt);
        } else {
          Logger.info('Found no s3 create handler for : %s', finder);
        }
      } else {
        const handler: S3CreateHandlerFunction = this.findInMap<S3CreateHandlerFunction>(finder, this.config.s3.createHandlers);
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

  public static async processCronEvent(evt: ScheduledEvent, cronConfig: CronConfig, saltMine: SaltMineHandler): Promise<boolean> {
    let rval: boolean = false;
    if (cronConfig && evt && evt.resources[0]) {
      // Run all the salt mine ones
      if (!!cronConfig.saltMineEntries) {
        if (!!saltMine) {
          const saltMineConfig: SaltMineConfig = saltMine.getConfig();
          const toEnqueue: SaltMineEntry[] = [];
          for (let i = 0; i < cronConfig.saltMineEntries.length; i++) {
            const smCronEntry: CronSaltMineEntry = cronConfig.saltMineEntries[i];
            if (CronUtil.eventMatchesEntry(evt, smCronEntry, cronConfig)) {
              Logger.info('Firing Salt-Mine cron : %s', CronUtil.cronEntryName(smCronEntry));

              const metadata: any = Object.assign(
                {},
                EpsilonGlobalHandler.resolvePotentialFunctionToResult<any>(smCronEntry.metadata, {}),
                {
                  cronDelegate: true,
                  cronSourceEvent: evt,
                }
              );

              const saltMineEntry: SaltMineEntry = {
                type: smCronEntry.saltMineTaskType,
                created: new Date().getTime(),
                data: EpsilonGlobalHandler.resolvePotentialFunctionToResult<any>(smCronEntry.data, {}),
                metadata: metadata,
              };
              Logger.silly('Resolved entry : %j', saltMineEntry);
              if (smCronEntry.fireImmediate) {
                await SaltMineQueueManager.fireImmediateProcessRequest(saltMineConfig, saltMineEntry);
                rval = true;
              } else {
                toEnqueue.push(saltMineEntry);
              }
            }
          }
          if (toEnqueue.length > 0) {
            await SaltMineQueueManager.addEntriesToQueue(saltMineConfig, toEnqueue, true);
            rval = true;
          }
        } else {
          Logger.warn('Cron defines salt mine tasks, but no salt mine provided');
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
    if (this.config && this.config.dynamoDb && !this.config.disabled.dynamoDb && evt && evt.Records && evt.Records.length > 0) {
      const finder: string = evt.Records[0].eventSourceARN;
      const handler: DynamoDbHandlerFunction = this.findInMap<DynamoDbHandlerFunction>(finder, this.config.dynamoDb.handlers);
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
