import { EpsilonLambdaEventHandler } from '../config/epsilon-lambda-event-handler';
import { Context, DynamoDBStreamEvent, ProxyResult, S3Event } from 'aws-lambda';
import { GenericAwsEventHandlerFunction } from '../config/generic-aws-event-handler-function';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { AwsUtil } from '../util/aws-util';
import { EpsilonInstance } from '../epsilon-instance';
import { LambdaEventDetector } from '@bitblit/ratchet/dist/aws/lambda-event-detector';

export class DynamoEpsilonLambdaEventHandler implements EpsilonLambdaEventHandler<DynamoDBStreamEvent> {
  constructor(private _epsilon: EpsilonInstance) {}

  public extractLabel(evt: DynamoDBStreamEvent, context: Context): string {
    return 'DDBEvt:' + evt.Records[0].eventName + ':' + evt.Records[0].eventSource;
  }

  public handlesEvent(evt: any): boolean {
    return LambdaEventDetector.isValidDynamoDBEvent(evt);
  }

  public async processEvent(evt: DynamoDBStreamEvent, context: Context): Promise<ProxyResult> {
    let rval: any = null;
    if (this._epsilon.config && this._epsilon.config.dynamoDb && evt && evt.Records && evt.Records.length > 0) {
      const finder: string = evt.Records[0].eventSourceARN;
      const handler: GenericAwsEventHandlerFunction<DynamoDBStreamEvent> = AwsUtil.findInMap<
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
}
