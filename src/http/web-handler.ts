import { EpsilonRouter } from './route/epsilon-router';
import { APIGatewayEvent, APIGatewayProxyResult, Context, ProxyResult } from 'aws-lambda';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import Route from 'route-parser';
import { RouteMapping } from './route/route-mapping';
import { ResponseUtil } from './response-util';
import { ExtendedAPIGatewayEvent } from './route/extended-api-gateway-event';
import { RequireRatchet } from '@bitblit/ratchet/dist/common/require-ratchet';
import { EpsilonHttpError } from './error/epsilon-http-error';
import { BuiltInFilters } from '../built-in/http/built-in-filters';
import { PromiseRatchet } from '@bitblit/ratchet/dist/common/promise-ratchet';
import { NotFoundError } from './error/not-found-error';
import { TimeoutToken } from '@bitblit/ratchet/dist/common/timeout-token';
import { RequestTimeoutError } from './error/request-timeout-error';

/**
 * This class functions as the adapter from a default lambda function to the handlers exposed via Epsilon
 */
export class WebHandler {
  public static readonly MAXIMUM_LAMBDA_BODY_SIZE_BYTES: number = 1024 * 1024 * 5 - 1024 * 100; // 5Mb - 100k buffer

  constructor(private routerConfig: EpsilonRouter) {
    RequireRatchet.notNullOrUndefined(routerConfig);
  }

  public get router(): EpsilonRouter {
    return this.routerConfig;
  }

  public async lambdaHandler(event: APIGatewayEvent, context: Context): Promise<ProxyResult> {
    if (!this.routerConfig) {
      throw new Error('Router config not found');
    }
    const rval: ProxyResult = await this.openApiLambdaHandler(Object.assign({}, { parsedBody: null, authorization: null }, event), context);
    return rval;
    Logger.setTracePrefix(null); // Just in case it was set
  }

  public async openApiLambdaHandler(evt: ExtendedAPIGatewayEvent, context: Context): Promise<ProxyResult> {
    const rm: RouteAndParse = this.findBestMatchingRoute(evt);
    let vals: [ExtendedAPIGatewayEvent, Context, ProxyResult, boolean] = null;
    try {
      vals = await BuiltInFilters.combineFilters(evt, context, {} as ProxyResult, rm.mapping.metaProcessingConfig.preFilters);
      if (vals[3]) {
        // Check for continue
        // Run the controller
        const handler: Promise<any> = this.findHandler(rm, vals[0], vals[1]);
        Logger.debug('Processing event with epsilon: %j', vals[0]);
        const result: any = await handler;
        if (TimeoutToken.isTimeoutToken(result)) {
          (result as TimeoutToken).writeToLog();
          throw new RequestTimeoutError('Timed out');
        }
        Logger.debug('Initial return value : %j', result);
        vals[2] = ResponseUtil.coerceToProxyResult(result);

        // Run post-processors
        vals = await BuiltInFilters.combineFilters(vals[0], vals[1], vals[2], rm.mapping.metaProcessingConfig.postFilters);
      }
    } catch (err) {
      // Convert to an epsilon error
      const wrapper: EpsilonHttpError = EpsilonHttpError.wrapError(err);
      vals[2] = ResponseUtil.errorResponse(wrapper.sanitizeErrorForPublicIfDefaultSet(null));
      try {
        vals = await BuiltInFilters.combineFilters(evt, context, vals[2], rm.mapping.metaProcessingConfig.errorFilters);
      } catch (convErr) {
        Logger.error('REALLY BAD - FAILED WHILE PROCESSING ERROR FILTERS : %s', convErr);
      }
    }
    return vals[2];
  }

  public async findHandler(
    rm: RouteAndParse,
    event: ExtendedAPIGatewayEvent,
    context: Context,
    add404OnMissing: boolean = true
  ): Promise<any> {
    let rval: Promise<any> = null;
    // Execute
    if (rm) {
      // We extend with the parsed params here in case we are using the AWS any proxy
      event.pathParameters = Object.assign({}, event.pathParameters, rm.parsed);

      rval = PromiseRatchet.timeout(
        rm.mapping.function(event, context),
        'Timed out after ' + rm.mapping.metaProcessingConfig.timeoutMS + ' ms.  Request was ' + JSON.stringify(event),
        rm.mapping.metaProcessingConfig.timeoutMS
      );
    } else if (add404OnMissing) {
      throw new NotFoundError('No such endpoint');
    }
    return rval;
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
        this.routerConfig.config.prefixesToStripBeforeRouteMatch
      );
    }
    return rval;
  }

  private cleanPath(event: APIGatewayEvent): string {
    let rval: string = event.path;
    // First, strip any leading /
    while (rval.startsWith('/')) {
      rval = rval.substring(1);
    }
    // If there are any listed prefixes, strip them
    if (this.routerConfig.config.prefixesToStripBeforeRouteMatch) {
      this.routerConfig.config.prefixesToStripBeforeRouteMatch.forEach((prefix) => {
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
}

export interface RouteAndParse {
  mapping: RouteMapping;
  route: Route;
  parsed: any;
}
