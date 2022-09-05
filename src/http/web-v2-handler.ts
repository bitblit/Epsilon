import { APIGatewayEvent, APIGatewayProxyEventV2, Context, ProxyResult } from 'aws-lambda';
import { ExtendedAPIGatewayEvent } from '../config/http/extended-api-gateway-event';
import { AwsUtil } from '../util/aws-util';
import { EpsilonLambdaEventHandler } from '../config/epsilon-lambda-event-handler';
import { LambdaEventDetector } from '@bitblit/ratchet/aws/lambda-event-detector';
import { WebHandler } from './web-handler';

/**
 * This class functions as the adapter from a default lambda function to the handlers exposed via Epsilon
 */
export class WebV2Handler implements EpsilonLambdaEventHandler<APIGatewayProxyEventV2> {
  constructor(private webHandler: WebHandler) {}

  public extractLabel(evt: APIGatewayProxyEventV2, context: Context): string {
    let rval: string = this.webHandler.extractLabel(AwsUtil.apiGatewayV2ToApiGatewayV1(evt), context);
    rval = rval.replace('WEB:', 'WEB2:');
    return rval;
  }

  public handlesEvent(evt: any): boolean {
    return LambdaEventDetector.isValidApiGatewayV2WithRequestContextEvent(evt);
  }

  public async processEvent(evt: APIGatewayProxyEventV2, context: Context): Promise<ProxyResult> {
    const conv: APIGatewayEvent = AwsUtil.apiGatewayV2ToApiGatewayV1(evt);
    const asExtended: ExtendedAPIGatewayEvent = Object.assign(
      {},
      { parsedBody: null, authorization: null, convertedFromV2Event: true },
      conv
    );
    const rval: ProxyResult = await this.webHandler.openApiLambdaHandler(asExtended, context);
    return rval;
  }
}
