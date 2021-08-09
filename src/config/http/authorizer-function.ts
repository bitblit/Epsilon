import { RouteMapping } from '../../http/route/route-mapping';
import { EpsilonAuthorizationContext } from './epsilon-authorization-context';
import { ExtendedAPIGatewayEvent } from './extended-api-gateway-event';

export interface AuthorizerFunction {
  (authData: EpsilonAuthorizationContext<any>, event?: ExtendedAPIGatewayEvent, route?: RouteMapping): Promise<boolean>;
}
