import {
  APIGatewayEvent,
  APIGatewayEventRequestContextV2,
  APIGatewayEventRequestContextWithAuthorizer,
  APIGatewayProxyEventV2,
} from 'aws-lambda';

// This class holds any random stuff I need to deal with AWS weirdness
export class AwsUtil {
  public static apiGatewayV2ToApiGatewayV1(srcEvt: APIGatewayProxyEventV2): APIGatewayEvent {
    const rval: APIGatewayEvent = {
      requestContext: AwsUtil.apiGatewayV2RequestContextToApiGatewayV1RequestContext(srcEvt.requestContext),
      httpMethod: srcEvt.requestContext.http.method,
      path: srcEvt.requestContext.http.path,
      queryStringParameters: srcEvt.queryStringParameters,
      headers: srcEvt.headers,
      body: srcEvt.body,
      isBase64Encoded: srcEvt.isBase64Encoded,
      multiValueHeaders: null,
      multiValueQueryStringParameters: null,
      pathParameters: srcEvt.pathParameters,
      stageVariables: srcEvt.stageVariables,
      resource: null,
    };
    return rval;
  }

  public static apiGatewayV2RequestContextToApiGatewayV1RequestContext(
    srcEvt: APIGatewayEventRequestContextV2
  ): APIGatewayEventRequestContextWithAuthorizer<any> {
    const rval: APIGatewayEventRequestContextWithAuthorizer<any> = {
      accountId: srcEvt.accountId,
      apiId: srcEvt.apiId,
      authorizer: null, //srcEvtTAuthorizerContext;

      domainName: srcEvt.domainName,
      domainPrefix: srcEvt.domainPrefix,

      requestId: srcEvt.requestId,
      routeKey: srcEvt.routeKey,
      stage: srcEvt.stage,

      requestTime: srcEvt.time,
      requestTimeEpoch: srcEvt.timeEpoch,

      //connectedAt?: number | undefined;
      //connectionId?: string | undefined;
      //eventType?: string | undefined;
      //extendedRequestId?: string | undefined;
      protocol: srcEvt.http.protocol,
      httpMethod: srcEvt.http.method,
      identity: null, // APIGatewayEventIdentity;
      //messageDirection?: string | undefined;
      //messageId?: string | null | undefined;
      path: srcEvt.http.path,
      resourceId: null, //string;
      resourcePath: null, //string;
    };
    return rval;
  }

  public static findInMap<T>(toFind: string, map: Map<string, T>): T {
    let rval: T = null;
    map.forEach((val, key) => {
      if (AwsUtil.matchExact(key, toFind)) {
        rval = val;
      }
    });
    return rval;
  }

  public static matchExact(r, str) {
    const match = str.match(r);
    return match != null && str == match[0];
  }

  // Returns either the value if non-function, the result if function, and default if neither
  public static resolvePotentialFunctionToResult<T>(src: any, def: T): T {
    let rval: T = def;
    if (src) {
      if (typeof src === 'function') {
        rval = src();
      } else {
        rval = src;
      }
    }
    return rval;
  }
}
