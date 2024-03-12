import { StringRatchet } from '@bitblit/ratchet/common/string-ratchet';
import { UnauthorizedError } from '../../http/error/unauthorized-error';
import { MisconfiguredError } from '../../http/error/misconfigured-error';
import { CommonJwtToken } from '@bitblit/ratchet/common/common-jwt-token';
import { FilterChainContext } from '../../config/http/filter-chain-context';
import { ForbiddenError } from '../../http/error/forbidden-error';
import { AuthorizerFunction } from '../../config/http/authorizer-function';
import { WebTokenManipulator } from '../../http/auth/web-token-manipulator';
import { EventUtil } from '../../http/event-util';
import { JwtTokenBase } from '@bitblit/ratchet/common';

export class BuiltInAuthFilters {
  public static async requireAllRolesInCommonJwt(fCtx: FilterChainContext, requiredRoleAllOf: string[]): Promise<boolean> {
    if (!requiredRoleAllOf || requiredRoleAllOf.length === 0) {
      throw new MisconfiguredError('You must require at least 1 role');
    }
    if (!fCtx.event?.authorization?.auth) {
      throw new UnauthorizedError('May not proceed, not authenticated');
    } else {
      const asJwt: CommonJwtToken<any> = fCtx.event.authorization.auth;
      if (!asJwt.roles || asJwt.roles.length === 0) {
        throw new UnauthorizedError('Required role not found');
      } else {
        requiredRoleAllOf.forEach((r) => {
          if (!asJwt.roles.includes(r)) {
            // As soon as 1 is missing we are done
            throw new UnauthorizedError('Required role not found');
          }
        });
      }
    }

    return true;
  }

  public static async requireAnyRoleInCommonJwt(fCtx: FilterChainContext, requiredRoleOneOf: string[]): Promise<boolean> {
    if (!requiredRoleOneOf || requiredRoleOneOf.length === 0) {
      throw new MisconfiguredError('You must require at least 1 role');
    }
    if (!fCtx.event?.authorization?.auth) {
      throw new UnauthorizedError('May not proceed, not authenticated');
    } else {
      const asJwt: CommonJwtToken<any> = fCtx.event.authorization.auth;
      if (!asJwt.roles || asJwt.roles.length === 0) {
        throw new UnauthorizedError('Required role not found');
      } else {
        let found: boolean = false;
        requiredRoleOneOf.forEach((r) => {
          if (!found && asJwt.roles.includes(r)) {
            // Not found just to shortcut
            found = true;
          }
        });
        if (!found) {
          throw new UnauthorizedError('Required role not found');
        }
      }
    }

    return true;
  }

  public static async parseAuthorizationHeader(
    fCtx: FilterChainContext,
    webTokenManipulators: WebTokenManipulator<JwtTokenBase> | WebTokenManipulator<JwtTokenBase>[],
  ): Promise<boolean> {
    if (!fCtx?.event || !webTokenManipulators || (Array.isArray(webTokenManipulators) && !webTokenManipulators.length)) {
      throw new MisconfiguredError('Cannot continue - missing event or encryption');
    } else {
      // We dont throw errors if no token - just just decodes, it DOESNT enforce having tokens
      const tokenString: string = EventUtil.extractBearerTokenFromEvent(fCtx?.event);
      if (!Array.isArray(webTokenManipulators)) {
        webTokenManipulators = [webTokenManipulators];
      }
      for (let i = 0; i < webTokenManipulators.length && !fCtx?.event?.authorization?.auth; i++) {
        const manipulator: WebTokenManipulator<JwtTokenBase> = webTokenManipulators[i];
        try {
          // We include the prefix (like 'bearer') in case the token wants to code more than one type
          const token: JwtTokenBase = await manipulator.extractTokenFromAuthorizationHeader(tokenString);
          fCtx.event.authorization = {
            raw: tokenString,
            auth: token,
            error: null,
          };
        } catch (err) {
          fCtx.event.authorization = {
            raw: tokenString,
            auth: null,
            error: err['message'],
          };
          fCtx.allowManipulatorErrorMessagesInResponses = manipulator.allowErrorMessagesInResponses
            ? manipulator.allowErrorMessagesInResponses()
            : false;
        }
      }
    }
    return true;
  }

  public static async applyOpenApiAuthorization(fCtx: FilterChainContext): Promise<boolean> {
    // Check if this endpoint requires authorization
    // Use !== true below because commonly it just wont be spec'd
    if (StringRatchet.trimToNull(fCtx?.routeAndParse?.mapping?.authorizerName)) {
      const authorizer: AuthorizerFunction = fCtx?.authenticators?.get(fCtx.routeAndParse.mapping.authorizerName);
      if (authorizer) {
        if (fCtx?.event?.authorization?.auth) {
          const allowed: boolean = await authorizer(fCtx.event.authorization, fCtx.event, fCtx.routeAndParse.mapping);
          if (!allowed) {
            throw new ForbiddenError('You lack privileges to see this endpoint');
          }
        } else {
          throw new UnauthorizedError(
            fCtx.allowManipulatorErrorMessagesInResponses
              ? fCtx.event.authorization.error
              : 'You need to supply credentials for this endpoint',
          );
        }
      } else {
        throw new MisconfiguredError().withFormattedErrorMessage(
          'Authorizer %s requested but not found',
          fCtx.routeAndParse.mapping.authorizerName,
        );
      }
    } else {
      // Do nothing (unauthenticated endpoint)
    }
    return true;
  }
}
