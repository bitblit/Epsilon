import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { APIGatewayEvent, APIGatewayProxyEvent, Context, Handler, ProxyResult } from 'aws-lambda';
import { PromiseRatchet } from '@bitblit/ratchet/dist/common/promise-ratchet';
import { TimeoutToken } from '@bitblit/ratchet/dist/common/timeout-token';
import { RequestTimeoutError } from '../../http/error/request-timeout-error';
import { ApolloServer, CreateHandlerOptions } from 'apollo-server-lambda';
import { FilterFunction } from '../../config/http/filter-function';
import { FilterChainContext } from '../../config/http/filter-chain-context';
import { EventUtil } from '../../http/event-util';
import { MapRatchet } from '@bitblit/ratchet/dist/common/map-ratchet';

export class ApolloFilter {
  private static CACHE_APOLLO_HANDLER: Handler<APIGatewayProxyEvent, ProxyResult>;

  public static async handlePathWithApollo(
    fCtx: FilterChainContext,
    apolloPathRegex: RegExp,
    apolloServer: ApolloServer,
    createHandlerOptions: CreateHandlerOptions
  ): Promise<boolean> {
    if (fCtx.event?.path && apolloPathRegex && apolloPathRegex.test(fCtx.event.path)) {
      fCtx.result = await ApolloFilter.processApolloRequest(fCtx.event, fCtx.context, apolloServer, createHandlerOptions);
      return false;
    } else {
      // Not handled by apollo
      return true;
    }
  }

  public static async processApolloRequest(
    event: APIGatewayEvent,
    context: Context,
    apolloServer: ApolloServer,
    createHandlerOptions: CreateHandlerOptions
  ): Promise<ProxyResult> {
    Logger.silly('Processing event with apollo: %j', event);
    let rval: ProxyResult = null;
    if (!ApolloFilter.CACHE_APOLLO_HANDLER) {
      ApolloFilter.CACHE_APOLLO_HANDLER = apolloServer.createHandler(createHandlerOptions);
    }

    // Apollo V3 requires all values to ALSO be in the multiValuesHeader fields or it craps out
    // as of 2022-01-16.  See https://github.com/apollographql/apollo-server/issues/5504#issuecomment-883376139
    event.multiValueHeaders = event.multiValueHeaders || {};
    Object.keys(event.headers).forEach((k) => {
      event.multiValueHeaders[k] = [event.headers[k]];
    });
    //event.headers['Content-Type'] = MapRatchet.caseInsensitiveAccess<string>(event.headers, 'Content-Type'); // || 'application/json';
    event.httpMethod = event.httpMethod.toUpperCase();
    if (event.isBase64Encoded && !!event.body) {
      event.body = Buffer.from(event.body, 'base64').toString();
      event.isBase64Encoded = false;
    }

    const x: any = ApolloFilter.CACHE_APOLLO_HANDLER;
    Logger.info('x:%s', x);
    const apolloPromise: Promise<ProxyResult> = ApolloFilter.CACHE_APOLLO_HANDLER(event, context, null) || Promise.resolve(null);

    // We do this because fully timing out on Lambda is never a good thing
    const timeoutMS: number = context.getRemainingTimeInMillis() - 500;

    let result: any = null;
    if (timeoutMS) {
      result = await PromiseRatchet.timeout(apolloPromise, 'Apollo timed out after ' + timeoutMS + ' ms.', timeoutMS);
    } else {
      Logger.warn('No timeout set even after defaulting for Apollo');
      result = await apolloPromise;
    }

    if (TimeoutToken.isTimeoutToken(result)) {
      (result as TimeoutToken).writeToLog();
      throw new RequestTimeoutError('Timed out');
    }

    // If we made it here, we didn't time out
    rval = result;
    return rval;
  }

  public static addApolloFilterToList(
    filters: FilterFunction[],
    apolloPathRegex: RegExp,
    apolloServer: ApolloServer,
    createHandlerOptions: CreateHandlerOptions
  ): void {
    if (filters) {
      filters.push((fCtx) => ApolloFilter.handlePathWithApollo(fCtx, apolloPathRegex, apolloServer, createHandlerOptions));
    }
  }
}

/*
export interface ApolloHandlerFunction {
  (event: APIGatewayProxyEvent, context: any, callback: APIGatewayProxyCallback): void;
}

 */
