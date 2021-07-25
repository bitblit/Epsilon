import { ExtendedAPIGatewayEvent } from './extended-api-gateway-event';
import { Context } from 'aws-lambda';

export interface HandlerFunction<T> {
  (event: ExtendedAPIGatewayEvent, context?: Context): Promise<T>;
}
