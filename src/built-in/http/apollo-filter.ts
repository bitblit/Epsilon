import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { APIGatewayEvent, APIGatewayProxyCallback, APIGatewayProxyEvent, Context, ProxyResult } from 'aws-lambda';
import { PromiseRatchet } from '@bitblit/ratchet/dist/common/promise-ratchet';
import { TimeoutToken } from '@bitblit/ratchet/dist/common/timeout-token';
import { RequestTimeoutError } from '../../http/error/request-timeout-error';
import { ApolloServer, CreateHandlerOptions } from 'apollo-server-lambda';
import { FilterFunction } from '../../config/http/filter-function';
import { FilterChainContext } from '../../config/http/filter-chain-context';

export class ApolloFilter {
  private static CACHE_APOLLO_HANDLER: ApolloHandlerFunction;

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
    const apolloPromise: Promise<ProxyResult> = new Promise<ProxyResult>((res, rej) => {
      if (!ApolloFilter.CACHE_APOLLO_HANDLER) {
        ApolloFilter.CACHE_APOLLO_HANDLER = apolloServer.createHandler(createHandlerOptions);
      }
      try {
        event.httpMethod = event.httpMethod.toUpperCase();
        if (event.isBase64Encoded && !!event.body) {
          event.body = Buffer.from(event.body, 'base64').toString();
          event.isBase64Encoded = false;
        }

        ApolloFilter.CACHE_APOLLO_HANDLER(event, context, (err, value) => {
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

export interface ApolloHandlerFunction {
  (event: APIGatewayProxyEvent, context: any, callback: APIGatewayProxyCallback): void;
}
