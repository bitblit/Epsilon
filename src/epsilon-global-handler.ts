import {
    APIGatewayEvent,
    Context, DynamoDBStreamEvent,
    S3CreateEvent,
    ScheduledEvent,
    SNSEvent
} from 'aws-lambda';
import {Logger} from '@bitblit/ratchet/dist/common/logger';
import {EpsilonConfig} from './global/epsilon-config';
import {WebHandler} from './api-gateway/web-handler';
import {LambdaEventDetector} from '@bitblit/ratchet/dist/aws/lambda-event-detector';
import {EpsilonDisableSwitches} from './global/epsilon-disable-switches';
import {SaltMine} from '@bitblit/saltmine/dist/salt-mine';
import {SnsHandlerFunction} from './batch/sns-handler-function';
import {S3HandlerFunction} from './batch/s3-handler-function';
import {CronHandlerFunction} from './batch/cron-handler-function';
import {DynamoDbHandlerFunction} from './batch/dynamo-db-handler-function';


/**
 * This class functions as the adapter from a default lamda function to the handlers exposed via Epsilon
 */
export class EpsilonGlobalHandler {
    private cacheWebHandler: WebHandler;

    constructor(private config: EpsilonConfig) {
        if (!config) {
            throw new Error('Cannot create with null config');
        }
        if (!config.disabled) {
            config.disabled = {} as EpsilonDisableSwitches;
        }

    }

    private fetchSaltMine(): SaltMine {
        return (this.config.saltMine && !this.config.disabled.saltMine) ? this.config.saltMine : null;
    }

    private fetchWebHandler(): WebHandler {
        if (!this.cacheWebHandler) {
            if (this.config.apiGateway && !this.config.disabled.apiGateway) {
                this.cacheWebHandler = new WebHandler(this.config.apiGateway);
            }
        }
        return this.cacheWebHandler;
    }

    public async lambdaHandler(event: any, context: Context): Promise<any> {
        let rval : any = null;
        try {
            if (!this.config) {
                Logger.error('Config not found, abandoning');
                return false;
            }

            if (LambdaEventDetector.isValidApiGatewayEvent(event)) {
                const wh: WebHandler = this.fetchWebHandler();
                if (wh) {
                    rval = await wh.lambdaHandler(event as APIGatewayEvent);
                } else {
                    Logger.warn('API Gateway event, but no handler or disabled');
                }
            } else if (LambdaEventDetector.isValidSnsEvent(event)) {
                // If salt mine is here, it takes precedence
                const sm: SaltMine = this.fetchSaltMine();
                if (sm && sm.handler.isSaltMineStartSnsEvent(event)) {
                    rval = await sm.handler.processSaltMineSNSEvent(event, context);
                } else {
                    rval = await this.processSnsEvent(event as SNSEvent);
                }
            } else if (LambdaEventDetector.isValidS3Event(event)) {
                rval = await this.processS3Event(event as S3CreateEvent);
            } else if (LambdaEventDetector.isValidCronEvent(event)) {
                rval = await this.processCronEvent(event as ScheduledEvent);
            } else if (LambdaEventDetector.isValidDynamoDBEvent(event)) {
                rval = await this.processDynamoDbEvent(event as DynamoDBStreamEvent);
            } else {
                Logger.warn('Unrecognized event, returning false : %j', event);
            }

            return rval;
        } catch (err) {
            Logger.error('Error slipped out to outer edge.  Logging and returning false : %s', err, err);
            return false;
        }
    };

    private async processSnsEvent(evt: SNSEvent): Promise<any> {
        let rval: any = null;
        if (this.config && this.config.sns && !this.config.disabled.sns && evt && evt.Records.length>0) {
            const handler: SnsHandlerFunction = this.config.sns.handlers.get(evt.Records[0].Sns.TopicArn);
            if (handler) {
                rval = await handler(evt);
            }
        }
        return rval;
    }

    private async processS3Event(evt: S3CreateEvent): Promise<any> {
        let rval: any = null;
        if (this.config && this.config.s3 && !this.config.disabled.s3 && evt && evt.Records.length>0) {
            const handler: S3HandlerFunction = this.config.s3.handlers.get(evt.Records[0].s3.bucket.name);
            if (handler) {
                rval = await handler(evt);
            }
        }
        return rval;
    }

    private async processCronEvent(evt: ScheduledEvent): Promise<any> {
        let rval: any = null;
        if (this.config && this.config.cron && !this.config.disabled.cron && evt && evt.resources[0]) {
            const handler: CronHandlerFunction = this.config.cron.handlers.get(evt.resources[0]);
            if (handler) {
                rval = await handler(evt);
            }
        }
        return rval;
    }

    private async processDynamoDbEvent(evt: DynamoDBStreamEvent): Promise<any> {
        let rval: any = null;
        if (this.config && this.config.dynamoDb && !this.config.disabled.dynamoDb && evt && evt.Records && evt.Records.length > 0) {
            const handler: DynamoDbHandlerFunction = this.config.dynamoDb.handlers.get(evt.Records[0].eventSourceARN);
            if (handler) {
                rval = await handler(evt);
            }
        }
        return rval;
    }

}
