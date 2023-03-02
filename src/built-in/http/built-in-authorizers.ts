import { Logger } from '@bitblit/ratchet/common/logger';
import { APIGatewayEvent } from 'aws-lambda';
import { RouteMapping } from '../../http/route/route-mapping';
import { EpsilonAuthorizationContext } from '../../config/http/epsilon-authorization-context';
import { CommonJwtToken } from '@bitblit/ratchet/common';

export class BuiltInAuthorizers {
  public static async simpleNoAuthenticationLogAccess(
    authorizationContext: EpsilonAuthorizationContext<any>,
    evt: APIGatewayEvent
  ): Promise<boolean> {
    // Just logs the request but does nothing else
    Logger.debug('Auth requested for %s : %j', evt.path, authorizationContext?.auth);
    return true;
  }

  public static async simpleLoggedInAuth(authorizationContext: EpsilonAuthorizationContext<any>, evt: APIGatewayEvent): Promise<boolean> {
    // Just verifies that there is a valid token in the request
    const rval: boolean = !!authorizationContext?.auth;
    Logger.silly('SimpleLoggedInAuth returning %s for %s', rval, evt.path);
    return rval;
  }

  public static async simpleRoleRouteAuth(
    authorizationContext: EpsilonAuthorizationContext<any>,
    event: APIGatewayEvent,
    route: RouteMapping,
    requiredRoleOneOf: string[] = null,
    requiredRoleAllOf: string[] = null
  ): Promise<boolean> {
    let rval: boolean = true;
    const token: CommonJwtToken<any> = authorizationContext?.auth;
    if (token) {
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
    } else {
      Logger.warn('Cannot authenticate - no parsed auth found');
      rval = false;
    }
    return rval;
  }
}
