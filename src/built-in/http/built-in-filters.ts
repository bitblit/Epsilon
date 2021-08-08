import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { Context, ProxyResult } from 'aws-lambda';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import { ExtendedAPIGatewayEvent } from '../../http/route/extended-api-gateway-event';
import { MapRatchet } from '@bitblit/ratchet/dist/common/map-ratchet';
import { EventUtil } from '../../http/event-util';
import { BadRequestError } from '../../http/error/bad-request-error';
import { FilterFunction } from '../../config/http/filter-function';
import { ResponseUtil } from '../../http/response-util';

export class BuiltInFilters {
  public static async combineFilters(
    event: ExtendedAPIGatewayEvent,
    context: Context,
    result: ProxyResult,
    filters: FilterFunction[]
  ): Promise<[ExtendedAPIGatewayEvent, Context, ProxyResult, boolean]> {
    let vals: [ExtendedAPIGatewayEvent, Context, ProxyResult, boolean] = [event, context, result, true];
    if (filters && filters.length > 0) {
      for (let i = 0; i < filters.length && vals[3]; i++) {
        vals = await filters[i](vals[0], vals[1], vals[2]);
      }
    }
    return vals;
  }

  public static async applyGzipIfPossible(
    event: ExtendedAPIGatewayEvent,
    context: Context,
    result: ProxyResult
  ): Promise<[ExtendedAPIGatewayEvent, Context, ProxyResult, boolean]> {
    let newResult: ProxyResult = result;
    if (event?.headers && result) {
      const encodingHeader: string =
        event && event.headers ? MapRatchet.extractValueFromMapIgnoreCase(event.headers, 'accept-encoding') : null;
      newResult = await ResponseUtil.applyGzipIfPossible(encodingHeader, newResult);
    }
    return [event, context, newResult, true];
  }

  public static async addConstantHeaders(
    event: ExtendedAPIGatewayEvent,
    context: Context,
    result: ProxyResult,
    headers: Record<string, string>
  ): Promise<[ExtendedAPIGatewayEvent, Context, ProxyResult, boolean]> {
    if (headers && result) {
      result.headers = Object.assign({}, headers, result.headers);
    } else {
      Logger.warn('Could not add headers - either result or headers were missing');
    }
    return [event, context, result, true];
  }

  public static async addAWSRequestIdHeader(
    event: ExtendedAPIGatewayEvent,
    context: Context,
    result: ProxyResult,
    headerName: string = 'X-REQUEST-ID'
  ): Promise<[ExtendedAPIGatewayEvent, Context, ProxyResult, boolean]> {
    if (result && StringRatchet.trimToNull(headerName) && headerName.startsWith('X-')) {
      result.headers = result.headers || {};
      result.headers[headerName] = context?.awsRequestId || 'Request-Id-Missing';
    } else {
      Logger.warn('Could not add request id header - either result or context were missing or name was invalid');
    }
    return [event, context, result, true];
  }

  public static async addAllowEverythingCORSHeaders(
    event: ExtendedAPIGatewayEvent,
    context: Context,
    result: ProxyResult
  ): Promise<[ExtendedAPIGatewayEvent, Context, ProxyResult, boolean]> {
    return BuiltInFilters.addConstantHeaders(event, context, result, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
    });
  }

  public static async addAllowReflectionCORSHeaders(
    event: ExtendedAPIGatewayEvent,
    context: Context,
    result: ProxyResult
  ): Promise<[ExtendedAPIGatewayEvent, Context, ProxyResult, boolean]> {
    return BuiltInFilters.addConstantHeaders(event, context, result, {
      'Access-Control-Allow-Origin': MapRatchet.caseInsensitiveAccess<string>(event.headers, 'Origin') || '*',
      'Access-Control-Allow-Methods': MapRatchet.caseInsensitiveAccess<string>(event.headers, 'Access-Control-Request-Headers') || '*',
      'Access-Control-Allow-Headers': MapRatchet.caseInsensitiveAccess<string>(event.headers, 'Access-Control-Request-Method') || '*',
    });
  }

  public static async fixStillEncodedQueryParameters(
    event: ExtendedAPIGatewayEvent,
    context: Context,
    result: ProxyResult
  ): Promise<[ExtendedAPIGatewayEvent, Context, ProxyResult, boolean]> {
    EventUtil.fixStillEncodedQueryParams(event);
    return [event, context, result, true];
  }

  public static async disallowStringNullAsPathParameter(
    event: ExtendedAPIGatewayEvent,
    context: Context,
    result: ProxyResult
  ): Promise<[ExtendedAPIGatewayEvent, Context, ProxyResult, boolean]> {
    if (event && event.pathParameters) {
      Object.keys(event.pathParameters).forEach((k) => {
        if ('null' === StringRatchet.trimToEmpty(event.pathParameters[k]).toLowerCase()) {
          throw new BadRequestError().withFormattedErrorMessage('Path parameter %s was string -null-', k);
        }
      });
    }
    return [event, context, result, true];
  }

  public static async disallowStringNullAsQueryStringParameter(
    event: ExtendedAPIGatewayEvent,
    context: Context,
    result: ProxyResult
  ): Promise<[ExtendedAPIGatewayEvent, Context, ProxyResult, boolean]> {
    if (event && event.queryStringParameters) {
      Object.keys(event.queryStringParameters).forEach((k) => {
        if ('null' === StringRatchet.trimToEmpty(event.queryStringParameters[k]).toLowerCase()) {
          throw new BadRequestError().withFormattedErrorMessage('Path parameter %s was string -null-', k);
        }
      });
    }
    return [event, context, result, true];
  }

  public static async ensureEventMaps(
    event: ExtendedAPIGatewayEvent,
    context: Context,
    result: ProxyResult
  ): Promise<[ExtendedAPIGatewayEvent, Context, ProxyResult, boolean]> {
    event.queryStringParameters = event.queryStringParameters || {};
    event.headers = event.headers || {};
    event.pathParameters = event.pathParameters || {};
    return [event, context, result, true];
  }

  public static async parseBodyObject(
    event: ExtendedAPIGatewayEvent,
    context: Context,
    result: ProxyResult
  ): Promise<[ExtendedAPIGatewayEvent, Context, ProxyResult, boolean]> {
    if (event?.body) {
      event.parsedBody = EventUtil.bodyObject(event);
    }
    return [event, context, result, true];
  }

  public static defaultEpsilonPreFilters(): FilterFunction[] {
    return [
      (evt, context, result) => BuiltInFilters.ensureEventMaps(evt, context, result),
      (evt, context, result) => BuiltInFilters.parseBodyObject(evt, context, result),
      (evt, context, result) => BuiltInFilters.fixStillEncodedQueryParameters(evt, context, result),
      (evt, context, result) => BuiltInFilters.disallowStringNullAsPathParameter(evt, context, result),
      (evt, context, result) => BuiltInFilters.disallowStringNullAsQueryStringParameter(evt, context, result),
    ];
  }

  public static defaultEpsilonPostFilters(): FilterFunction[] {
    return [
      (evt, context, result) => BuiltInFilters.addAWSRequestIdHeader(evt, context, result),
      (evt, context, result) => BuiltInFilters.addAllowReflectionCORSHeaders(evt, context, result),
      (evt, context, result) => BuiltInFilters.applyGzipIfPossible(evt, context, result),
    ];
  }

  public static defaultEpsilonErrorFilters(): FilterFunction[] {
    return [
      (evt, context, result) => BuiltInFilters.addAWSRequestIdHeader(evt, context, result),
      (evt, context, result) => BuiltInFilters.addAllowReflectionCORSHeaders(evt, context, result),
    ];
  }
}
