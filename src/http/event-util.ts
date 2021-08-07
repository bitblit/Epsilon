import { APIGatewayEvent, APIGatewayEventRequestContext, AuthResponseContext } from 'aws-lambda';
import { UnauthorizedError } from './error/unauthorized-error';
import { CommonJwtToken } from '@bitblit/ratchet/dist/common/common-jwt-token';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { BadRequestError } from './error/bad-request-error';
import { EpsilonLoggerConfig } from '../config/epsilon-logger-config';
import { MapRatchet } from '@bitblit/ratchet/dist/common/map-ratchet';
import jwt from 'jsonwebtoken';
import { ExtendedAuthResponseContext } from './route/extended-auth-response-context';
import { BasicAuthToken } from './auth/basic-auth-token';
import { Base64Ratchet } from '@bitblit/ratchet/dist/common/base64-ratchet';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';

/**
 * Endpoints about the api itself
 */
export class EventUtil {
  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static extractToken<T>(event: APIGatewayEvent): CommonJwtToken<T> {
    const auth: AuthResponseContext = EventUtil.extractAuthorizer(event);

    if (!auth) {
      Logger.debug('Could not extract authorizer from event : %j', event);
      throw new UnauthorizedError('Missing authorization context');
    } else {
      if (!!auth['userData']) {
        return auth['userData'] as any;
      } else if (auth['userDataJSON']) {
        return JSON.parse(StringRatchet.safeString(auth['userDataJSON'])) as CommonJwtToken<T>;
      } else {
        throw new UnauthorizedError('Missing authorization context data');
      }
    }
  }

  public static extractTokenSrc(event: APIGatewayEvent): string {
    const auth = EventUtil.extractAuthorizer(event);
    return auth ? StringRatchet.safeString(auth['srcData']) : null;
  }

  public static extractStage(event: APIGatewayEvent): string {
    // This differs from extractApiGatewayStage in that the "real" stage can be
    // mapped differently than the gateway stage.  This extracts the "real" stage
    // as just being the first part of the path.  If they are the same, no harm no
    // foul
    if (!event.path.startsWith('/')) {
      throw new BadRequestError('Path should start with / but does not : ' + event.path);
    }
    const idx = event.path.indexOf('/', 1);
    if (idx == -1) {
      throw new BadRequestError('No second / found in the path : ' + event.path);
    }
    return event.path.substring(1, idx);
  }

  public static extractHostHeader(event: APIGatewayEvent): string {
    return MapRatchet.extractValueFromMapIgnoreCase(event.headers, 'Host');
  }

  public static extractProtocol(event: APIGatewayEvent): string {
    // Since API gateway / ALB ALWAYS sets this
    return MapRatchet.extractValueFromMapIgnoreCase(event.headers, 'X-Forwarded-Proto');
  }

  public static extractApiGatewayStage(event: APIGatewayEvent): string {
    const rc: APIGatewayEventRequestContext = EventUtil.extractRequestContext(event);
    return rc ? rc.stage : null;
  }

  public static extractRequestContext(event: APIGatewayEvent): APIGatewayEventRequestContext {
    return event.requestContext;
  }

  public static extractAuthorizer(event: APIGatewayEvent): AuthResponseContext {
    const rc: APIGatewayEventRequestContext = EventUtil.extractRequestContext(event);
    return rc ? rc.authorizer : null;
  }

  public static ipAddressChain(event: APIGatewayEvent): string[] {
    const headerVal: string = event && event.headers ? MapRatchet.extractValueFromMapIgnoreCase(event.headers, 'X-Forwarded-For') : null;
    let headerList: string[] = headerVal ? String(headerVal).split(',') : [];
    headerList = headerList.map((s) => s.trim());
    return headerList;
  }

  public static ipAddress(event: APIGatewayEvent): string {
    const list: string[] = EventUtil.ipAddressChain(event);
    return list && list.length > 0 ? list[0] : null;
  }

  public static extractFullPath(event: APIGatewayEvent, overrideProtocol: string = null): string {
    const protocol: string = overrideProtocol || EventUtil.extractProtocol(event) || 'https';
    return protocol + '://' + event.requestContext['domainName'] + event.requestContext.path;
  }

  public static extractFullPrefix(event: APIGatewayEvent, overrideProtocol: string = null): string {
    const protocol: string = overrideProtocol || EventUtil.extractProtocol(event) || 'https';
    const prefix: string = event.requestContext.path.substring(0, event.requestContext.path.indexOf('/', 1));
    return protocol + '://' + event.requestContext['domainName'] + prefix;
  }

  public static bodyObject(event: APIGatewayEvent): any {
    let rval: any = null;
    if (event.body) {
      const contentType = MapRatchet.extractValueFromMapIgnoreCase(event.headers, 'Content-Type') || 'application/octet-stream';
      rval = event.body;

      if (event.isBase64Encoded) {
        rval = Buffer.from(rval, 'base64');
      }
      if (contentType.startsWith('application/json')) {
        // to handle cases where the charset is specified
        rval = JSON.parse(rval.toString('ascii'));
      }
    }
    return rval;
  }

  public static calcLogLevelViaEventOrEnvParam(curLevel: string, event: APIGatewayEvent, rConfig: EpsilonLoggerConfig): string {
    let rval: string = curLevel;
    if (rConfig && rConfig.envParamLogLevelName && process.env[rConfig.envParamLogLevelName]) {
      rval = process.env[rConfig.envParamLogLevelName];
      Logger.silly('Found env log level : %s', rval);
    }
    if (
      rConfig &&
      rConfig.queryParamLogLevelName &&
      event &&
      event.queryStringParameters &&
      event.queryStringParameters[rConfig.queryParamLogLevelName]
    ) {
      rval = event.queryStringParameters[rConfig.queryParamLogLevelName];
      Logger.silly('Found query log level : %s', rval);
    }
    return rval;
  }

  /**
   * This is a weird function - sometimes your customers will not unencode their query params and it
   * results in query params that look like 'amp;SOMETHING' instead of 'SOMETHING'.  This function
   * looks for params that look like that, and strips the amp; from them.  If you have any
   * params you are expecting that have 'amp;' in front of them, DON'T use this function.
   *
   * Also, you are a moron for having a param that looks like that
   *
   * Yes, it would be better to fix this on the client side, but that is not always an option
   * in production
   * @param event
   */
  public static fixStillEncodedQueryParams(event: APIGatewayEvent): void {
    if (!!event) {
      if (!!event.queryStringParameters) {
        const newParams: any = {};
        Object.keys(event.queryStringParameters).forEach((k) => {
          const val: string = event.queryStringParameters[k];
          if (k.toLowerCase().startsWith('amp;')) {
            newParams[k.substring(4)] = val;
          } else {
            newParams[k] = val;
          }
        });
        event.queryStringParameters = newParams;
      }
      if (!!event.multiValueQueryStringParameters) {
        const newParams: any = {};
        Object.keys(event.multiValueQueryStringParameters).forEach((k) => {
          const val: string[] = event.multiValueQueryStringParameters[k];
          if (k.toLowerCase().startsWith('amp;')) {
            newParams[k.substring(4)] = val;
          } else {
            newParams[k] = val;
          }
        });
        event.multiValueQueryStringParameters = newParams;
      }
    }
  }

  /**
   * Allows you to force in a token for an arbitrary event without having to pass the whole thing
   * through Epsilon.  Useful for when you need to test a handler that needs authorization,
   * and don't need to instantiate all of epsilon, just the handler
   * @param event Event to decorate
   * @param jwtToken String containing a valid JWT token
   */
  public static applyTokenToEventForTesting(event: APIGatewayEvent, jwtToken: string): void {
    const jwtFullData: any = jwt.decode(jwtToken, { complete: true });
    if (!jwtFullData['payload']) {
      throw new Error('No payload found in passed token');
    }
    // CAW 2020-05-03 : Have to strip the payload layer to match behavior of WebTokenManipulator in live
    const jwtData: any = jwtFullData['payload'];

    // Make the header consistent with the authorizer
    event.headers = event.headers || {};
    event.headers['authorization'] = 'Bearer ' + jwtToken;

    event.requestContext = event.requestContext || ({} as APIGatewayEventRequestContext);
    const newAuth: ExtendedAuthResponseContext = Object.assign({}, event.requestContext.authorizer) as ExtendedAuthResponseContext;
    newAuth.userData = jwtData;
    newAuth.userDataJSON = jwtData ? JSON.stringify(jwtData) : null;
    newAuth.srcData = jwtToken;
    event.requestContext.authorizer = newAuth;
  }

  public static extractBasicAuthenticationToken(event: APIGatewayEvent, throwErrorOnMissingBad: boolean = false): BasicAuthToken {
    let rval: BasicAuthToken = null;
    if (!!event && !!event.headers) {
      const headerVal: string = MapRatchet.caseInsensitiveAccess(event.headers, 'authorization');
      if (!!headerVal && headerVal.startsWith('Basic ')) {
        const parsed: string = Base64Ratchet.base64StringToString(headerVal.substring(6));
        const sp: string[] = parsed.split(':');
        Logger.silly('Parsed to %j', sp);
        if (!!sp && sp.length === 2) {
          rval = {
            username: sp[0],
            password: sp[1],
          };
        }
      }
    }

    if (!rval && throwErrorOnMissingBad) {
      throw new UnauthorizedError('Could not find valid basic authentication header');
    }
    return rval;
  }

  public static eventIsAGraphQLIntrospection(event: APIGatewayEvent): boolean {
    let rval: boolean = false;
    if (!!event) {
      if (!!event.httpMethod && 'post' === event.httpMethod.toLowerCase()) {
        if (!!event.path && event.path.endsWith('/graphql')) {
          const body: any = EventUtil.bodyObject(event);
          rval = !!body && !!body['operationName'] && body['operationName'] === 'IntrospectionQuery';
        }
      }
    }
    return rval;
  }
}
