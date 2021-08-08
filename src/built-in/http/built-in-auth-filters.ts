import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { Context, ProxyResult } from 'aws-lambda';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import { ExtendedAPIGatewayEvent } from '../../http/route/extended-api-gateway-event';
import { MapRatchet } from '@bitblit/ratchet/dist/common/map-ratchet';
import { EventUtil } from '../../http/event-util';
import { BadRequestError } from '../../http/error/bad-request-error';
import { FilterFunction } from '../../config/http/filter-function';
import { UnauthorizedError } from '../../http/error/unauthorized-error';
import { MisconfiguredError } from '../../http/error/misconfigured-error';
import jwt from 'jsonwebtoken';
import { CommonJwtToken } from '@bitblit/ratchet/dist/common/common-jwt-token';
import { FilterChainContext } from '../../config/http/filter-chain-context';

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

  public static async parseJwtBasedAuthorizationHeader(
    fCtx: FilterChainContext,
    encryptionKey: string,
    parseFailureLogLevel: string = 'debug'
  ): Promise<boolean> {
    if (!event || !encryptionKey) {
      throw new MisconfiguredError('Cannot continue - missing event or encryption');
    } else if (!fCtx.event.headers || !fCtx.event.headers['Authorization']) {
      throw new UnauthorizedError('Missing Authorization header');
    } else if (!fCtx.event.headers['Authorization'].toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedError('Authorization header malformed - does not start with the word Bearer');
    } else {
      const tokenString: string = fCtx.event.headers['Authorization'].substring(7); // Cut off Bearer
      try {
        const payload: any = jwt.verify(tokenString, encryptionKey);
        fCtx.event.authorization = {
          raw: tokenString,
          auth: payload,
          error: null,
        };
      } catch (err) {
        if (parseFailureLogLevel) {
          Logger.logByLevel(parseFailureLogLevel, 'Failed to parse JWT token : %s : %s', err.message, tokenString);
        }
        fCtx.event.authorization = {
          raw: tokenString,
          auth: null,
          error: err.message,
        };
      }
      if (!fCtx.event?.authorization?.auth) {
        throw new UnauthorizedError('Unable to parse a token from this string');
      }
    }
    return true;
  }
}
