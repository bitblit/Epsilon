import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { APIGatewayEvent } from 'aws-lambda';
import { CommonJwtToken } from '@bitblit/ratchet/dist/common/common-jwt-token';
import { RouteMapping } from '../../http/route/route-mapping';

export class BuiltInAuthorizers {
  public static async simpleLogAccessAuth(token: CommonJwtToken<any>, event: APIGatewayEvent, route: RouteMapping): Promise<boolean> {
    Logger.warn('Someone just hit background endpoint : %j', event);
    return true;
  }

  public static async simpleLoggedInAuth(token: CommonJwtToken<any>, event: APIGatewayEvent, route: RouteMapping): Promise<boolean> {
    // Just verifies that there is a valid token in the request
    const rval: boolean = !!token;
    Logger.silly('SimpleLoggedInAuth returning %s for %s', rval, event.path);
    return rval;
  }

  public static async simpleRoleRouteAuth(
    token: CommonJwtToken<any>,
    event: APIGatewayEvent,
    route: RouteMapping,
    requiredRoleOneOf: string[] = null,
    requiredRoleAllOf: string[] = null
  ): Promise<boolean> {
    let rval: boolean = true;
    if (requiredRoleOneOf) {
      requiredRoleOneOf.forEach((r) => {
        rval = rval || token.roles.indexOf(r) > -1;
      });
      if (!rval) {
        Logger.warn('Request to %s failed to find at least one of %j', route.path, requiredRoleOneOf);
      }
    }
    if (rval && requiredRoleAllOf) {
      requiredRoleAllOf.forEach((r) => {
        rval = rval && token.roles.indexOf(r) > -1;
      });
      if (!rval) {
        Logger.warn('Request to %s failed to find all of %j', route.path, requiredRoleAllOf);
      }
    }
    return rval;
  }
}
