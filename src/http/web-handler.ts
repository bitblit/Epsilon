import { RouterConfig } from './route/router-config';
import { APIGatewayEvent, APIGatewayProxyCallback, APIGatewayProxyEvent, APIGatewayProxyResult, Context, ProxyResult } from 'aws-lambda';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import Route from 'route-parser';
import { UnauthorizedError } from './error/unauthorized-error';
import { ForbiddenError } from './error/forbidden-error';
import { CommonJwtToken } from '@bitblit/ratchet/dist/common/common-jwt-token';
import { RouteMapping } from './route/route-mapping';
import { MisconfiguredError } from './error/misconfigured-error';
import { BadRequestError } from './error/bad-request-error';
import { ResponseUtil } from './response-util';
import { ExtendedAPIGatewayEvent } from './route/extended-api-gateway-event';
import { EventUtil } from './event-util';
import { ExtendedAuthResponseContext } from './route/extended-auth-response-context';
import { AuthorizerFunction } from './route/authorizer-function';
import { MapRatchet } from '@bitblit/ratchet/dist/common/map-ratchet';
import { WebTokenManipulatorUtil } from './auth/web-token-manipulator-util';
import { PromiseRatchet } from '@bitblit/ratchet/dist/common/promise-ratchet';
import { TimeoutToken } from '@bitblit/ratchet/dist/common/timeout-token';
import { RequestTimeoutError } from './error/request-timeout-error';
import { RequireRatchet } from '@bitblit/ratchet/dist/common/require-ratchet';
import { NotFoundError } from './error/not-found-error';
import { EpsilonHttpError } from './error/epsilon-http-error';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';

/**
 * This class functions as the adapter from a default lamda function to the handlers exposed via Epsilon
 */
export class WebHandler {
  public static readonly MAXIMUM_LAMBDA_BODY_SIZE_BYTES: number = 1024 * 1024 * 5 - 1024 * 100; // 5Mb - 100k buffer
  private cacheApolloHandler: ApolloHandlerFunction;

  constructor(private routerConfig: RouterConfig) {
    RequireRatchet.notNullOrUndefined(routerConfig);

    // Some cleanup
    // Validate the response header name, if set
    if (StringRatchet.trimToNull(this.routerConfig.requestIdResponseHeaderName)) {
      this.routerConfig.requestIdResponseHeaderName = StringRatchet.trimToEmpty(
        this.routerConfig.requestIdResponseHeaderName
      ).toUpperCase();
      RequireRatchet.true(this.routerConfig.requestIdResponseHeaderName.startsWith('X-')); // Valid new header
    }
  }

  public async lambdaHandler(event: APIGatewayEvent, context: Context): Promise<ProxyResult> {
    let rval: ProxyResult = null;
    try {
      if (!this.routerConfig) {
        throw new Error('Router config not found');
      }
      // Make sure no params of the format amp;(param) are in the event
      if (this.routerConfig.autoFixStillEncodedQueryParams) {
        EventUtil.fixStillEncodedQueryParams(event);
      }
      if (!!this.routerConfig.apolloRegex && this.routerConfig.apolloRegex.test(event.path)) {
        rval = await this.apolloLambdaHandler(event, context);
      } else {
        rval = await this.openApiLambdaHandler(event, context);
      }
    } catch (err) {
      // Convert to an epsilon error
      const wrapper: EpsilonHttpError = EpsilonHttpError.wrapError(err);
      // Force the request id in there
      wrapper.requestId = context.awsRequestId || 'Request-Id-Missing';

      if (wrapper.isWrappedError()) {
        try {
          // If the source error was not a epsilon error, run error processors if any
          await this.routerConfig.errorProcessor(event, wrapper, this.routerConfig);
        } catch (err) {
          Logger.error('Really bad - your error processor has an error in it : %s', err, err);
        }
      }

      const errProxy: APIGatewayProxyResult = ResponseUtil.errorResponse(wrapper.sanitizeErrorForPublicIfDefaultSet(null)); //this.routerConfig.defaultErrorMessage));
      rval = this.addCors(errProxy, event);
      Logger.setTracePrefix(null); // Just in case it was set
    }

    if (rval && this.routerConfig.requestIdResponseHeaderName) {
      rval.headers = rval.headers || {};
      rval.headers[this.routerConfig.requestIdResponseHeaderName] = context.awsRequestId;
    }

    return rval;
  }

  public async openApiLambdaHandler(event: APIGatewayEvent, context: Context): Promise<ProxyResult> {
    const rm: RouteAndParse = this.findBestMatchingRoute(event);
    const handler: Promise<any> = this.findHandler(rm, event, context);
    Logger.debug('Processing event with epsilon: %j', event);
    const result: any = await handler;
    if (TimeoutToken.isTimeoutToken(result)) {
      (result as TimeoutToken).writeToLog();
      throw new RequestTimeoutError('Timed out');
    }
    Logger.debug('Initial return value : %j', result);
    this.optionallyConvertNullReturnedObjectsTo404Error(result);
    this.optionallyApplyOutboundModelObjectCheck(rm, result);

    let proxyResult: ProxyResult = ResponseUtil.coerceToProxyResult(result);
    const initSize: number = proxyResult.body.length;
    Logger.silly('Proxy result : %j', proxyResult);
    proxyResult = this.addCors(proxyResult, event);
    Logger.silly('CORS result : %j', proxyResult);
    if (!this.routerConfig.disableCompression) {
      const encodingHeader: string =
        event && event.headers ? MapRatchet.extractValueFromMapIgnoreCase(event.headers, 'accept-encoding') : null;
      proxyResult = await ResponseUtil.applyGzipIfPossible(encodingHeader, proxyResult);
    }
    Logger.setTracePrefix(null); // Just in case it was set
    Logger.debug('Pre-process: %d bytes, post: %d bytes', initSize, proxyResult.body.length);
    if (proxyResult.body.length > WebHandler.MAXIMUM_LAMBDA_BODY_SIZE_BYTES) {
      const delta: number = proxyResult.body.length - WebHandler.MAXIMUM_LAMBDA_BODY_SIZE_BYTES;
      throw new EpsilonHttpError(
        'Response size is ' + proxyResult.body.length + ' bytes, which is ' + delta + ' bytes too large for this handler'
      ).withHttpStatusCode(500);
    }
    return proxyResult;
  }

  public optionallyApplyOutboundModelObjectCheck(rm: RouteAndParse, result: any): void {
    if (this.routerConfig.validateOutboundResponseBody) {
      if (this.routerConfig.modelValidator) {
        if (rm.mapping.outboundValidation) {
          Logger.debug('Applying outbound check to %j', result);
          const errors: string[] = this.routerConfig.modelValidator.validate(
            rm.mapping.outboundValidation.modelName,
            result,
            rm.mapping.outboundValidation.emptyAllowed,
            rm.mapping.outboundValidation.extraPropertiesAllowed
          );
          if (errors.length > 0) {
            Logger.error('Found outbound errors while validating %s object %j', rm.mapping.outboundValidation.modelName, errors);

            errors.unshift('Server sent object invalid according to spec');

            throw new EpsilonHttpError().withErrors(errors).withHttpStatusCode(500).withDetails(result);
          }
        } else {
          Logger.debug('Not validating - no outbound validator for this endpoint');
        }
      } else {
        throw new MisconfiguredError('Requested outbound validation but supplied no validator');
      }
    }
  }

  public optionallyConvertNullReturnedObjectsTo404Error(result: any): void {
    if (result === null || result === undefined) {
      if (this.routerConfig.convertNullReturnedObjectsTo404) {
        throw new NotFoundError('Resource not found');
      } else {
        Logger.warn('Null object returned from handler and convert not specified, converting to empty string');
        result = '';
      }
    }
  }

  public async apolloLambdaHandler(event: APIGatewayEvent, context: Context): Promise<ProxyResult> {
    Logger.silly('Processing event with apollo: %j', event);
    return new Promise<ProxyResult>((res, rej) => {
      if (!this.cacheApolloHandler) {
        this.cacheApolloHandler = this.routerConfig.apolloServer.createHandler(this.routerConfig.apolloCreateHandlerOptions);
      }
      try {
        event.httpMethod = event.httpMethod.toUpperCase();
        if (event.isBase64Encoded && !!event.body) {
          event.body = Buffer.from(event.body, 'base64').toString();
          event.isBase64Encoded = false;
        }

        this.cacheApolloHandler(event, context, (err, value) => {
          if (!!err) {
            Logger.error('Error when processing : %j : %s', event, err, err);
            rej(err);
          } else {
            res(value);
          }
        });
      } catch (err) {
        Logger.error('External catch fired for %j : %s : %s', event, err, err);
        rej(err);
      }
    });
  }

  // Public so it can be used in auth-web-handler
  public addCors(input: ProxyResult, srcEvent: APIGatewayEvent): ProxyResult {
    if (!this.routerConfig.disableCORS) {
      ResponseUtil.addCORSToProxyResult(input, this.routerConfig, srcEvent);
    }
    return input;
  }

  public findBestMatchingRoute(event: APIGatewayEvent): RouteAndParse {
    let rval: RouteAndParse = null;
    // See: https://www.npmjs.com/package/route-parser
    const cleanPath: string = this.cleanPath(event);

    // Filter routes to only matches
    const methodLower: string = event.httpMethod.toLowerCase();
    const matchRoutes: RouteAndParse[] = this.routerConfig.routes
      .map((r) => {
        let rval: RouteAndParse = null;
        if (r.method && r.method.toLowerCase() === methodLower) {
          const routeParser: Route = new Route(r.path);
          const parsed: any = routeParser.match(cleanPath);
          if (parsed !== false) {
            rval = {
              mapping: r,
              route: routeParser,
              parsed: parsed,
            };
          }
        }
        return rval;
      })
      .filter((r) => r != null);
    // Pick the 'best' match
    matchRoutes.sort((a, b) => {
      return Object.keys(a.parsed).length - Object.keys(b.parsed).length;
    });

    rval = matchRoutes && matchRoutes.length > 0 ? matchRoutes[0] : null;

    if (!rval) {
      Logger.debug(
        'Failed to find handler for %s (cleaned path was %s, strip prefixes were %j)',
        event.path,
        cleanPath,
        this.routerConfig.prefixesToStripBeforeRouteMatch
      );
    }
    return rval;
  }

  public async findHandler(rm: RouteAndParse, event: APIGatewayEvent, context: Context, add404OnMissing: boolean = true): Promise<any> {
    let rval: Promise<any> = null;

    // Execute
    if (rm) {
      // We extend with the parsed params here in case we are using the AWS any proxy
      event.pathParameters = Object.assign({}, event.pathParameters, rm.parsed);
      // Check for literal string null passed
      if (!this.routerConfig.allowLiteralStringNullAsPathParameter) {
        this.throwExceptionOnNullStringLiteralInParams(event.pathParameters);
      }
      if (!this.routerConfig.allowLiteralStringNullAsQueryStringParameter) {
        this.throwExceptionOnNullStringLiteralInParams(event.queryStringParameters);
      }

      // Check authentication / authorization
      // Throws an error on failure / misconfiguration
      await this.applyAuth(event, rm.mapping);

      // Cannot get here without a valid auth/body, would've thrown an error
      const extEvent: ExtendedAPIGatewayEvent = this.extendApiGatewayEvent(event, rm.mapping);

      // Check validation (throws error on failure)
      await this.applyBodyObjectValidation(extEvent, rm.mapping);
      const timeoutMS: number = rm.mapping.timeoutMS || this.routerConfig.defaultTimeoutMS;

      if (timeoutMS) {
        rval = PromiseRatchet.timeout(
          rm.mapping.function(extEvent, context),
          'Timed out after ' + rm.mapping.timeoutMS + ' ms.  Request was ' + JSON.stringify(event),
          rm.mapping.timeoutMS
        );
      } else {
        Logger.silly('No timeout set');
        rval = rm.mapping.function(extEvent, context);
      }
    } else if (add404OnMissing) {
      throw new NotFoundError('No such endpoint');
    }

    return rval;
  }

  private throwExceptionOnNullStringLiteralInParams(params: any): void {
    if (params) {
      Object.keys(params).forEach((k) => {
        const v: any = params[k];
        if (typeof v === 'string') {
          if (StringRatchet.trimToEmpty(v).toLowerCase() === 'null') {
            throw new BadRequestError('Literal string null provided for parameter');
          }
        }
      });
    }
  }

  private cleanPath(event: APIGatewayEvent): string {
    let rval: string = event.path;
    // First, strip any leading /
    while (rval.startsWith('/')) {
      rval = rval.substring(1);
    }
    // If there are any listed prefixes, strip them
    if (this.routerConfig.prefixesToStripBeforeRouteMatch) {
      this.routerConfig.prefixesToStripBeforeRouteMatch.forEach((prefix) => {
        if (rval.toLowerCase().startsWith(prefix.toLowerCase() + '/')) {
          rval = rval.substring(prefix.length);
        }
      });
    }

    // Strip any more leading /
    while (rval.startsWith('/')) {
      rval = rval.substring(1);
    }
    // Finally, put back exactly 1 leading / to match what comes out of open api
    rval = '/' + rval;

    return rval;
  }

  private extendApiGatewayEvent(event: APIGatewayEvent, routeMap: RouteMapping): ExtendedAPIGatewayEvent {
    const rval: ExtendedAPIGatewayEvent = Object.assign({}, event) as ExtendedAPIGatewayEvent;
    // Default all the key maps
    if (!rval.queryStringParameters && !routeMap.disableQueryMapAssure) {
      rval.queryStringParameters = {};
    }
    if (!rval.headers && !routeMap.disableHeaderMapAssure) {
      rval.headers = {};
    }
    if (!rval.pathParameters && !routeMap.disablePathMapAssure) {
      rval.pathParameters = {};
    }
    if (event.body && !routeMap.disableAutomaticBodyParse) {
      rval.parsedBody = EventUtil.bodyObject(rval);
    }

    return rval;
  }

  private async applyBodyObjectValidation(event: ExtendedAPIGatewayEvent, route: RouteMapping): Promise<void> {
    if (!event || !route) {
      throw new MisconfiguredError('Missing event or route');
    }

    if (route.validation) {
      if (!this.routerConfig.modelValidator) {
        throw new MisconfiguredError('Requested body validation but supplied no validator');
      }
      const errors: string[] = this.routerConfig.modelValidator.validate(
        route.validation.modelName,
        event.parsedBody,
        route.validation.emptyAllowed,
        route.validation.extraPropertiesAllowed
      );
      if (errors.length > 0) {
        Logger.info('Found errors while validating %s object %j', route.validation.modelName, errors);
        const newError: BadRequestError = new BadRequestError(...errors);
        throw newError;
      }
    }
  }

  // Returns a failing proxy result if no auth, otherwise returns null
  private async applyAuth(event: APIGatewayEvent, route: RouteMapping): Promise<void> {
    if (!event || !route) {
      throw new MisconfiguredError('Missing event or route');
    }

    if (route.authorizerName) {
      if (!this.routerConfig.webTokenManipulator) {
        throw new MisconfiguredError('Auth is defined, but token manipulator not set');
      }
      // Extract the token
      const token: CommonJwtToken<any> = await this.routerConfig.webTokenManipulator.extractTokenFromStandardEvent(event);
      if (!token) {
        Logger.info('Failed auth for route : %s - missing/bad token', route.path);
        throw new UnauthorizedError('Missing or bad token');
      } else {
        const authorizer: AuthorizerFunction = this.routerConfig.authorizers.get(route.authorizerName);
        if (!authorizer) {
          throw new MisconfiguredError('Route requires authorizer ' + route.authorizerName + ' but its not in the config');
        }

        if (authorizer) {
          const passes: boolean = await authorizer(token, event, route);
          if (!passes) {
            throw new ForbiddenError('Failed authorization');
          }
        }
      }

      // Put the token into scope just like it would be from a AWS authorizer
      const newAuth: ExtendedAuthResponseContext = Object.assign({}, event.requestContext.authorizer) as ExtendedAuthResponseContext;
      newAuth.userData = token;
      newAuth.userDataJSON = token ? JSON.stringify(token) : null;
      newAuth.srcData = WebTokenManipulatorUtil.extractTokenStringFromStandardEvent(event);
      event.requestContext.authorizer = newAuth;
    }
  }
}

export interface RouteAndParse {
  mapping: RouteMapping;
  route: Route;
  parsed: any;
}

export interface ApolloHandlerFunction {
  (event: APIGatewayProxyEvent, context: any, callback: APIGatewayProxyCallback): void;
}
