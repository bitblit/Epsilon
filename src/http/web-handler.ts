import { EpsilonRouter } from './route/epsilon-router';
import { APIGatewayEvent, Context, ProxyResult } from 'aws-lambda';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import Route from 'route-parser';
import { RouteMapping } from './route/route-mapping';
import { ResponseUtil } from './response-util';
import { ExtendedAPIGatewayEvent } from '../config/http/extended-api-gateway-event';
import { RequireRatchet } from '@bitblit/ratchet/dist/common/require-ratchet';
import { EpsilonHttpError } from './error/epsilon-http-error';
import { BuiltInFilters } from '../built-in/http/built-in-filters';
import { HttpMetaProcessingConfig } from '../config/http/http-meta-processing-config';
import { FilterFunction } from '../config/http/filter-function';
import { RunHandlerAsFilter } from '../built-in/http/run-handler-as-filter';
import { FilterChainContext } from '../config/http/filter-chain-context';

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
    const asExtended: ExtendedAPIGatewayEvent = Object.assign({}, { parsedBody: null, authorization: null }, event);
    const rval: ProxyResult = await this.openApiLambdaHandler(asExtended, context);
    Logger.setTracePrefix(null); // Just in case it was set
    return rval;
  }

  public async openApiLambdaHandler(evt: ExtendedAPIGatewayEvent, context: Context): Promise<ProxyResult> {
    const rm: RouteAndParse = this.findBestMatchingRoute(evt);
    const procConfig: HttpMetaProcessingConfig = rm?.mapping?.metaProcessingConfig
      ? rm.mapping.metaProcessingConfig
      : this.routerConfig.config.defaultMetaHandling;
    const fCtx: FilterChainContext = {
      event: evt,
      context: context,
      result: null,
      rawResult: null,
      routeAndParse: rm,
      modelValidator: this.routerConfig.config.overrideModelValidator || this.routerConfig.openApiModelValidator,
      authenticators: this.routerConfig.config.authorizers,
    };

    try {
      let filterChain: FilterFunction[] = Object.assign([], procConfig.preFilters || []);
      RunHandlerAsFilter.addRunHandlerAsFilterToList(filterChain, rm);
      filterChain = filterChain.concat(procConfig.postFilters || []);
      await BuiltInFilters.combineFilters(fCtx, filterChain);
    } catch (err) {
      // Convert to an epsilon error
      const wrapper: EpsilonHttpError = EpsilonHttpError.wrapError(err);
      fCtx.result = ResponseUtil.errorResponse(wrapper.sanitizeErrorForPublicIfDefaultSet(null));
      try {
        await BuiltInFilters.combineFilters(fCtx, procConfig.errorFilters);
      } catch (convErr) {
        Logger.error('REALLY BAD - FAILED WHILE PROCESSING ERROR FILTERS : %s', convErr);
      }
    }
    return fCtx.result;
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
