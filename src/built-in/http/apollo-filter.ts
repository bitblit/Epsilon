import {
  Base64Ratchet,
  Logger,
  PromiseRatchet,
  RequireRatchet,
  StringRatchet,
  TimeoutToken,
  RestfulApiHttpError,
} from '@bitblit/ratchet/common';
import { APIGatewayEvent, Context, ProxyResult } from 'aws-lambda';
import { RequestTimeoutError } from '../../http/error/request-timeout-error';
import { FilterFunction } from '../../config/http/filter-function';
import { FilterChainContext } from '../../config/http/filter-chain-context';
import { ApolloServer, BaseContext, ContextFunction, HeaderMap, HTTPGraphQLRequest, HTTPGraphQLResponse } from '@apollo/server';
import { ContextUtil } from '../../util/context-util';
import { EpsilonLambdaApolloOptions } from './apollo/epsilon-lambda-apollo-options';
import { EpsilonLambdaApolloContextFunctionArgument } from './apollo/epsilon-lambda-apollo-context-function-argument';
import { ApolloUtil } from './apollo/apollo-util';
import { EpsilonApolloCorsMethod } from './apollo/epsilon-apollo-cors-method';
import { BuiltInFilters } from './built-in-filters';

export class ApolloFilter {
  public static async handlePathWithApollo<T>(
    fCtx: FilterChainContext,
    apolloPathRegex: RegExp,
    apolloServer: ApolloServer<T>,
    options?: EpsilonLambdaApolloOptions<T>,
  ): Promise<boolean> {
    let rval: boolean = false;

    if (fCtx.event?.path && apolloPathRegex && apolloPathRegex.test(fCtx.event.path)) {
      fCtx.result = await ApolloFilter.processApolloRequest(fCtx.event, fCtx.context, apolloServer, options);

      if (options?.corsMethod) {
        switch (options.corsMethod) {
          case EpsilonApolloCorsMethod.All:
            await BuiltInFilters.addAllowEverythingCORSHeaders(fCtx);
            break;
          case EpsilonApolloCorsMethod.Reflective:
            await BuiltInFilters.addAllowReflectionCORSHeaders(fCtx);
            break;
          default:
          // Do nothing
        }
      }
    } else {
      // Not handled by apollo
      rval = true;
    }

    return rval;
  }

  public static async processApolloRequest<T>(
    event: APIGatewayEvent,
    context: Context,
    apolloServer: ApolloServer<T>,
    options?: EpsilonLambdaApolloOptions<T>,
  ): Promise<ProxyResult> {
    Logger.silly('Processing event with apollo: %j', event);
    let rval: ProxyResult = null;
    RequireRatchet.notNullOrUndefined(apolloServer, 'apolloServer');
    apolloServer.assertStarted('Cannot process with apollo - instance not started');

    const headerMap: HeaderMap = new HeaderMap();
    for (const headersKey in event.headers) {
      headerMap.set(headersKey, event.headers[headersKey]);
    }
    const eventMethod: string = StringRatchet.trimToEmpty(event.httpMethod).toUpperCase();
    let body: any = null;
    if (StringRatchet.trimToNull(event.body)) {
      const bodyString: string = event.isBase64Encoded ? Base64Ratchet.base64StringToString(event.body) : event.body;
      body = JSON.parse(bodyString);
    }

    const aRequest: HTTPGraphQLRequest = {
      method: eventMethod,
      headers: headerMap,
      search:
        eventMethod === 'GET' && event?.queryStringParameters
          ? Object.keys(event.queryStringParameters)
              .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(event.queryStringParameters[k]))
              .join('&')
          : null,
      body: body,
    };

    // We do this because fully timing out on Lambda is never a good thing
    const timeoutMS: number = options?.timeoutMS ?? context.getRemainingTimeInMillis() - 500;

    //const defaultContextFn: ContextFunction<[EpsilonLambdaApolloContextFunctionArgument], any> = async () => ({});

    const contextFn: ContextFunction<[EpsilonLambdaApolloContextFunctionArgument], T> = options?.context ?? ApolloUtil.emptyContext;

    const apolloPromise = apolloServer.executeHTTPGraphQLRequest({
      httpGraphQLRequest: aRequest,
      context: () => contextFn({ lambdaContext: context, lambdaEvent: event }),
    });

    let result: HTTPGraphQLResponse | TimeoutToken = null;
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

    // If we reach here we didn't time out
    const httpGraphQLResponse: HTTPGraphQLResponse = result as HTTPGraphQLResponse; // TODO: Use typeguard here instead

    const outHeaders: Record<string, string> = {};

    for (const [headersKey, headersValue] of httpGraphQLResponse.headers.entries()) {
      outHeaders[headersKey] = headersValue;
    }

    if (httpGraphQLResponse.body.kind === 'chunked') {
      // This is legal according to https://www.apollographql.com/docs/apollo-server/integrations/building-integrations/
      throw new RestfulApiHttpError('Apollo returned chunked result').withHttpStatusCode(500).withRequestId(ContextUtil.currentRequestId());
    }

    const bodyAsString: string = StringRatchet.trimToEmpty(httpGraphQLResponse?.body?.string);

    rval = {
      body: Base64Ratchet.generateBase64VersionOfString(bodyAsString),
      headers: outHeaders,
      multiValueHeaders: {}, // TODO: Need setting?
      isBase64Encoded: true,
      statusCode: httpGraphQLResponse.status || 200,
    };

    // Finally, a double check to set the content type correctly if the browser page was shown
    // Since otherwise Apollo defaults it to application/json for some reason
    if (eventMethod === 'GET' && rval.headers['content-type'] !== 'text/html' && bodyAsString.indexOf('<!DOCTYPE html>') >= 0) {
      Logger.info('Forcing content type to html for the sandbox page');
      rval.headers = rval.headers || {};
      rval.headers['content-type'] = 'text/html';
    }

    return rval;
  }

  public static addApolloFilterToList(
    filters: FilterFunction[],
    apolloPathRegex: RegExp,
    apolloServer: ApolloServer,
    options?: EpsilonLambdaApolloOptions<BaseContext>,
  ): void {
    if (filters) {
      filters.push((fCtx) => ApolloFilter.handlePathWithApollo(fCtx, apolloPathRegex, apolloServer, options));
    }
  }
}
