import { Context, ProxyResult } from 'aws-lambda';
import { ExtendedAPIGatewayEvent } from '../../http/route/extended-api-gateway-event';

export interface FilterFunction {
  (event: ExtendedAPIGatewayEvent, context: Context, result: ProxyResult): Promise<
    [ExtendedAPIGatewayEvent, Context, ProxyResult, boolean]
  >;
}
