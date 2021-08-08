import { Context, ProxyResult } from 'aws-lambda';
import { ExtendedAPIGatewayEvent } from '../../http/route/extended-api-gateway-event';

export interface FilterChainContext {
  event: ExtendedAPIGatewayEvent;
  context: Context;
  result: ProxyResult;
}
