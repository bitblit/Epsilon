import {ExtendedAPIGatewayEvent} from './extended-api-gateway-event';

export interface HandlerFunction<T> {
    (event: ExtendedAPIGatewayEvent): Promise<T>
}
