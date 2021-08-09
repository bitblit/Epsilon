import { APIGatewayEvent } from 'aws-lambda';
import { RouteMapping } from '../../http/route/route-mapping';
import { EpsilonAuthorizationContext } from './epsilon-authorization-context';

export interface AuthorizerFunction {
  (authData: EpsilonAuthorizationContext<any>, event?: APIGatewayEvent, route?: RouteMapping): Promise<boolean>;
}
