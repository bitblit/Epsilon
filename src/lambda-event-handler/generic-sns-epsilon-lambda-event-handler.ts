import { EpsilonLambdaEventHandler } from '../config/epsilon-lambda-event-handler';
import { Context, ProxyResult, S3Event, SNSEvent } from 'aws-lambda';
import { GenericAwsEventHandlerFunction } from '../config/generic-aws-event-handler-function';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { AwsUtil } from '../util/aws-util';
import { EpsilonInstance } from '../epsilon-instance';
import { LambdaEventDetector } from '@bitblit/ratchet/dist/aws/lambda-event-detector';

export class GenericSnsEpsilonLambdaEventHandler implements EpsilonLambdaEventHandler<SNSEvent> {
  constructor(private _epsilon: EpsilonInstance) {}

  public extractLabel(evt: SNSEvent, context: Context): string {
    return 'SNSEvt:' + evt.Records[0].EventSource;
  }

  public handlesEvent(evt: any): boolean {
    return LambdaEventDetector.isValidSnsEvent(evt);
  }

  public async processEvent(evt: SNSEvent, context: Context): Promise<ProxyResult> {
    let rval: any = null;
    if (this._epsilon.config && this._epsilon.config.sns && evt && evt.Records.length > 0) {
      const finder: string = evt.Records[0].Sns.TopicArn;
      const handler: GenericAwsEventHandlerFunction<SNSEvent> = AwsUtil.findInMap<GenericAwsEventHandlerFunction<SNSEvent>>(
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
}