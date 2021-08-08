import { Context, ProxyResult } from 'aws-lambda';
import { ExtendedAPIGatewayEvent } from '../../http/route/extended-api-gateway-event';
import { RouteAndParse } from '../../http/web-handler';
import { ModelValidator } from '@bitblit/ratchet/dist/model-validator';

export interface FilterChainContext {
  event: ExtendedAPIGatewayEvent;
  context: Context;
  rawResult: any; // Result before coercion to a proxyResult
  result: ProxyResult;
  routeAndParse: RouteAndParse;
  modelValidator: ModelValidator;
}
