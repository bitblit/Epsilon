import { RouteMapping } from './route-mapping';
import { CommonJwtToken } from '@bitblit/ratchet/dist/common/common-jwt-token';
import { APIGatewayEvent } from 'aws-lambda';

export interface AuthorizerFunction {
  (token: CommonJwtToken<any>, event: APIGatewayEvent, route: RouteMapping): Promise<boolean>;
}
