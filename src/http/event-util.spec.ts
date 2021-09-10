import { APIGatewayEvent, APIGatewayEventRequestContext } from 'aws-lambda';
import { EventUtil } from './event-util';
import { BasicAuthToken } from './auth/basic-auth-token';
import fs from 'fs';
import path from 'path';

describe('#eventUtil', function () {
  it('should extract pieces', function () {
    const evt: APIGatewayEvent = {
      httpMethod: 'GET',
      path: '/cw/meta/server',
      body: null,
      headers: {
        Host: 'api.test.com',
        'X-Forwarded-Proto': 'https',
      },
      multiValueHeaders: {
        Host: ['api.test.com'],
        'X-Forwarded-Proto': ['https'],
      },
      multiValueQueryStringParameters: null,
      isBase64Encoded: false,
      pathParameters: null,
      queryStringParameters: null,
      stageVariables: null,
      resource: '/{proxy+}',
      requestContext: {
        httpMethod: 'GET',
        accountId: '1234',
        apiId: '7890',
        stage: 'v0',
        path: '/cw/meta/server',
        domainName: 'api.test.com',
        identity: null,
        requestId: 'asdf1234',
        requestTimeEpoch: 1234,
        resourceId: '1234',
        resourcePath: '/{proxy+}',
      } as APIGatewayEventRequestContext,
    } as APIGatewayEvent;

    expect(EventUtil.extractStage(evt)).toEqual('cw');
    expect(EventUtil.extractApiGatewayStage(evt)).toEqual('v0');
    expect(EventUtil.extractFullPrefix(evt)).toEqual('https://api.test.com/cw');
    expect(EventUtil.extractFullPath(evt)).toEqual('https://api.test.com/cw/meta/server');
    expect(EventUtil.extractHostHeader(evt)).toEqual('api.test.com');
  });

  it('should fix still encoded query params', function () {
    const evt: APIGatewayEvent = {
      httpMethod: 'GET',
      path: '/cw/meta/server',
      body: null,
      headers: {
        Host: 'api.test.com',
        'X-Forwarded-Proto': 'https',
      },
      multiValueHeaders: {
        Host: ['api.test.com'],
        'X-Forwarded-Proto': ['https'],
      },
      isBase64Encoded: false,
      pathParameters: null,
      multiValueQueryStringParameters: {
        a: ['b'],
        'amp;c': ['d'],
      },
      queryStringParameters: {
        a: 'b',
        'amp;c': 'd',
      },
      stageVariables: null,
      resource: '/{proxy+}',
      requestContext: {
        httpMethod: 'GET',
        accountId: '1234',
        apiId: '7890',
        stage: 'v0',
        path: '/cw/meta/server',
        domainName: 'api.test.com',
        identity: null,
        requestId: 'asdf1234',
        requestTimeEpoch: 1234,
        resourceId: '1234',
        resourcePath: '/{proxy+}',
      } as APIGatewayEventRequestContext,
    } as APIGatewayEvent;

    expect(evt.queryStringParameters['a']).toBeTruthy();
    expect(evt.queryStringParameters['amp;c']).toBeTruthy();
    expect(evt.queryStringParameters['c']).toBeUndefined();

    EventUtil.fixStillEncodedQueryParams(evt);

    expect(evt.queryStringParameters['a']).toBeTruthy();
    expect(evt.queryStringParameters['amp;c']).toBeUndefined();
    expect(evt.queryStringParameters['c']).toBeTruthy();
  });

  it('should extract basic auth from headers', function () {
    const evt: APIGatewayEvent = {
      httpMethod: 'GET',
      path: '/cw/meta/server',
      body: null,
      headers: {
        Host: 'api.test.com',
        'X-Forwarded-Proto': 'https',
        Authorization: 'Basic dGVzdHVzZXI6dGVzdHBhc3M=',
      },
      multiValueHeaders: {
        Host: ['api.test.com'],
        'X-Forwarded-Proto': ['https'],
        Authorization: ['Basic dGVzdHVzZXI6dGVzdHBhc3M='],
      },
      isBase64Encoded: false,
      pathParameters: null,
      multiValueQueryStringParameters: {
        a: ['b'],
        'amp;c': ['d'],
      },
      queryStringParameters: {
        a: 'b',
        'amp;c': 'd',
      },
      stageVariables: null,
      resource: '/{proxy+}',
      requestContext: {
        httpMethod: 'GET',
        accountId: '1234',
        apiId: '7890',
        stage: 'v0',
        path: '/cw/meta/server',
        domainName: 'api.test.com',
        identity: null,
        requestId: 'asdf1234',
        requestTimeEpoch: 1234,
        resourceId: '1234',
        resourcePath: '/{proxy+}',
      } as APIGatewayEventRequestContext,
    } as APIGatewayEvent;

    const basic: BasicAuthToken = EventUtil.extractBasicAuthenticationToken(evt);
    expect(basic).toBeTruthy();
    expect(basic.username).toBeTruthy();
    expect(basic.password).toBeTruthy();
    expect(basic.username).toEqual('testuser');
    expect(basic.password).toEqual('testpass');
  });

  it('should add a token to an event, along with downstream stuff', function () {
    const evt: APIGatewayEvent = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../test-data/sample-json/sample-request-1.json')).toString()
    );
    const jwtToken: string =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1ODg1MzY3NzU4ODcsImlzcyI6Im5lb24uYWRvbW5pLmNvbSIsInN1YiI6ImJpdGJsaXRAZ21haWwuY29tIiwiaWF0IjoxNTg4NTMzMTc1ODg3LCJ1c2VyIjp7ImlkIjo2LCJmaXJzdE5hbWUiOiJDaHJpcyIsImxhc3ROYW1lIjoiV2Vpc3MiLCJjb21wYW55IjoiQWRvbW5pIiwiZW1haWwiOiJiaXRibGl0QGdtYWlsLmNvbSIsImN1c3RvbWVyVHlwZSI6IkFETUlOIn0sImFjdGluZ1VzZXJJZCI6NiwiZ2xvYmFsIjp0cnVlLCJhZG1pbiI6eyJpZCI6NiwiZmlyc3ROYW1lIjoiQ2hyaXMiLCJsYXN0TmFtZSI6IldlaXNzIiwiY29tcGFueSI6IkFkb21uaSIsImVtYWlsIjoiYml0YmxpdEBnbWFpbC5jb20iLCJjdXN0b21lclR5cGUiOiJBRE1JTiJ9LCJzdWJVc2VycyI6W119.mwRSek5GwkvxpN44UTp49W6_9U_ARsFXThAyiqaF-eQ';
    EventUtil.applyTokenToEventForTesting(evt, jwtToken);

    const roundTripTokenString: string = EventUtil.extractBearerTokenFromEvent(evt);
    expect(roundTripTokenString).toEqual(jwtToken);
  });

  it('should check if an event is a graphql introspection', function () {
    const evt1: APIGatewayEvent = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../test-data/sample-json/sample-request-1.json')).toString()
    );
    const evt2: APIGatewayEvent = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../test-data/sample-json/sample-gql-introspection.json')).toString()
    );

    const res1: boolean = EventUtil.eventIsAGraphQLIntrospection(evt1);
    const res2: boolean = EventUtil.eventIsAGraphQLIntrospection(evt2);

    expect(res1).toBeFalsy();
    expect(res2).toBeTruthy();
  });
});
