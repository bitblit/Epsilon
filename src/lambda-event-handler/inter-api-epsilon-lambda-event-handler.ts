import { EpsilonLambdaEventHandler } from '../config/epsilon-lambda-event-handler';
import { Context, ProxyResult, S3Event, SNSEvent } from 'aws-lambda';
import { GenericAwsEventHandlerFunction } from '../config/generic-aws-event-handler-function';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { AwsUtil } from '../util/aws-util';
import { EpsilonInstance } from '../epsilon-instance';
import { LambdaEventDetector } from '@bitblit/ratchet/dist/aws/lambda-event-detector';
import { InterApiUtil } from '../inter-api/inter-api-util';
import { InterApiEntry } from '../inter-api/inter-api-entry';

export class InterApiEpsilonLambdaEventHandler implements EpsilonLambdaEventHandler<SNSEvent> {
  constructor(private _epsilon: EpsilonInstance) {}

  public extractLabel(evt: SNSEvent, context: Context): string {
    const ent: InterApiEntry<any> = InterApiUtil.extractEntryFromEvent(evt);
    return 'InterApi:' + ent.source + ':' + ent.type;
  }

  public handlesEvent(evt: any): boolean {
    return this._epsilon.config.interApiConfig && InterApiUtil.isInterApiSnsEvent(evt);
  }

  public async processEvent(evt: SNSEvent, context: Context): Promise<ProxyResult> {
    const tmp: string[] = await InterApiUtil.processInterApiEvent(
      evt,
      this._epsilon.config.interApiConfig,
      this._epsilon.backgroundManager
    );
    const rval: ProxyResult = {
      statusCode: 200,
      body: JSON.stringify(tmp),
      isBase64Encoded: false,
    };

    return rval;
  }
}
