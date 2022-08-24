import { EpsilonLambdaEventHandler } from '../config/epsilon-lambda-event-handler';
import { Context, ProxyResult, S3Event } from 'aws-lambda';
import { GenericAwsEventHandlerFunction } from '../config/generic-aws-event-handler-function';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { AwsUtil } from '../util/aws-util';
import { EpsilonInstance } from '../epsilon-instance';
import { LambdaEventDetector } from '@bitblit/ratchet/dist/aws/lambda-event-detector';

export class S3EpsilonLambdaEventHandler implements EpsilonLambdaEventHandler<S3Event> {
  constructor(private _epsilon: EpsilonInstance) {}

  public extractLabel(evt: S3Event, context: Context): string {
    return 'S3Evt:' + evt.Records[0].eventSource;
  }

  public handlesEvent(evt: any): boolean {
    return LambdaEventDetector.isValidS3Event(evt);
  }

  public async processEvent(evt: S3Event, context: Context): Promise<ProxyResult> {
    let rval: any = null;
    if (this._epsilon.config && this._epsilon.config.s3 && evt && evt.Records.length > 0) {
      const finder: string = evt.Records[0].s3.bucket.name + '/' + evt.Records[0].s3.object.key;
      const isRemoveEvent: boolean = evt.Records[0].eventName && evt.Records[0].eventName.startsWith('ObjectRemoved');

      if (isRemoveEvent) {
        const handler: GenericAwsEventHandlerFunction<S3Event> = AwsUtil.findInMap<GenericAwsEventHandlerFunction<S3Event>>(
          finder,
          this._epsilon.config.s3.removeHandlers
        );
        if (handler) {
          rval = await handler(evt);
        } else {
          Logger.info('Found no s3 create handler for : %s', finder);
        }
      } else {
        const handler: GenericAwsEventHandlerFunction<S3Event> = AwsUtil.findInMap<GenericAwsEventHandlerFunction<S3Event>>(
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
}
