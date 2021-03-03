import { RouterConfig } from './http/route/router-config';
import { APIGatewayEvent, APIGatewayEventRequestContext, Context, ProxyResult } from 'aws-lambda';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import http from 'http';
import { IncomingMessage, Server, ServerResponse } from 'http';
import { WebHandler } from './http/web-handler';
import { PromiseRatchet } from '@bitblit/ratchet/dist/common/promise-ratchet';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import { DateTime } from 'luxon';
import qs from 'querystring';
import { AuthorizerFunction } from './http/route/authorizer-function';
import { HandlerFunction } from './http/route/handler-function';
import { SimpleRoleRouteAuth } from './http/auth/simple-role-route-auth';
import { RouterUtil } from './http/route/router-util';
import fs from 'fs';
import path from 'path';
import { BuiltInHandlers } from './http/route/built-in-handlers';
import { EpsilonConstants } from './epsilon-constants';
import { ErrorRatchet } from '@bitblit/ratchet/dist/common/error-ratchet';
import { NumberRatchet } from '@bitblit/ratchet/dist/common/number-ratchet';
import { EventUtil } from './http/event-util';
import { LocalWebTokenManipulator } from './http/auth/local-web-token-manipulator';

/**
 * A simplistic server for testing your lambdas locally
 */
export class LocalServer {
  private server: Server;
  private webHandler: WebHandler;
  private aborted: boolean = false;

  constructor(private routerConfig: RouterConfig, private port: number = 8888) {
    this.webHandler = new WebHandler(routerConfig);
  }

  async runServer(): Promise<boolean> {
    Logger.info('Starting Epsilon server on port %d', this.port);
    this.server = http.createServer(this.requestHandler.bind(this)).listen(this.port);
    Logger.info('Epsilon server is listening');

    // Also listen for SIGINT
    process.on('SIGINT', () => {
      Logger.info('Caught SIGINT - shutting down test server...');
      this.aborted = true;
    });

    return this.checkFinished();
  }

  async checkFinished(): Promise<boolean> {
    if (this.aborted) {
      return true;
    } else {
      const wait: any = await PromiseRatchet.wait(1000);
      return this.checkFinished();
    }
  }

  async requestHandler(request: IncomingMessage, response: ServerResponse): Promise<any> {
    const context: Context = {
      awsRequestId: 'LOCAL-' + StringRatchet.createType4Guid(),
      getRemainingTimeInMillis(): number {
        return 300000;
      },
    } as Context; //TBD
    const evt: APIGatewayEvent = await this.messageToApiGatewayEvent(request, context);
    const logEventLevel: string = EventUtil.eventIsAGraphQLIntrospection(evt) ? 'silly' : 'info';

    Logger.logByLevel(logEventLevel, 'Processing event: %j', evt);

    if (evt.path == '/epsilon-poison-pill') {
      this.aborted = true;
      return true;
    } else {
      const result: ProxyResult = await this.webHandler.lambdaHandler(evt, context);
      const written: boolean = await this.writeProxyResultToServerResponse(result, response);
      return written;
    }
  }

  private async bodyAsBase64String(request: IncomingMessage): Promise<string> {
    return new Promise<string>((res, rej) => {
      const body = [];
      request.on('data', (chunk) => {
        body.push(chunk);
      });
      request.on('end', () => {
        const rval: string = Buffer.concat(body).toString('base64');
        res(rval);
      });
    });
  }

  private async messageToApiGatewayEvent(request: IncomingMessage, context: Context): Promise<APIGatewayEvent> {
    const bodyString: string = await this.bodyAsBase64String(request);
    const stageIdx: number = request.url.indexOf('/', 1);
    const stage: string = request.url.substring(1, stageIdx);
    const path: string = request.url.substring(stageIdx + 1);

    const reqTime: number = new Date().getTime();
    const formattedTime: string = DateTime.utc().toFormat('dd/MMM/yyyy:hh:mm:ss ZZ');
    const queryIdx: number = request.url.indexOf('?');
    const queryStringParams: any = queryIdx > -1 ? qs.parse(request.url.substring(queryIdx + 1)) : {};
    const headers: any = Object.assign({}, request.headers);
    headers['X-Forwarded-Proto'] = 'http'; // This server is always unencrypted

    const rval: APIGatewayEvent = {
      body: bodyString,
      multiValueHeaders: {},
      multiValueQueryStringParameters: {},
      resource: '/{proxy+}',
      path: request.url,
      httpMethod: request.method.toLowerCase(),
      isBase64Encoded: true,
      queryStringParameters: queryStringParams,
      pathParameters: {
        proxy: path,
      },
      stageVariables: {
        baz: 'qux',
      },
      headers: headers,
      requestContext: {
        accountId: '123456789012',
        resourceId: '123456',
        stage: stage,
        requestId: context.awsRequestId,
        requestTime: formattedTime, // '09/Apr/2015:12:34:56 +0000',
        requestTimeEpoch: reqTime, //1428582896000,
        identity: null,
        /*
                identity: {
                    apiKey: null,
                    cognitoIdentityPoolId: null,
                    accountId: null,
                    cognitoIdentityId: null,
                    caller: null,
                    accessKey: null,
                    sourceIp: '127.0.0.1',
                    cognitoAuthenticationType: null,
                    cognitoAuthenticationProvider: null,
                    userArn: null,
                    userAgent: 'Custom User Agent String',
                    user: null
                },
                */
        path: request.url, // /prod/path/to/resource
        domainName: request.headers['host'],
        resourcePath: '/{proxy+}',
        httpMethod: request.method.toLowerCase(),
        apiId: '1234567890',
        protocol: 'HTTP/1.1',
      } as APIGatewayEventRequestContext,
    } as APIGatewayEvent;

    return rval;
  }

  private async writeProxyResultToServerResponse(proxyResult: ProxyResult, response: ServerResponse): Promise<boolean> {
    const isGraphQLSchemaResponse: boolean = !!proxyResult && !!proxyResult.body && proxyResult.body.indexOf('{"data":{"__schema"') > -1;

    if (!isGraphQLSchemaResponse) {
      Logger.debug('Result: %j', proxyResult);
    }

    response.statusCode = proxyResult.statusCode;
    if (proxyResult.headers) {
      Object.keys(proxyResult.headers).forEach((hk) => {
        response.setHeader(hk, String(proxyResult.headers[hk]));
      });
    }
    const toWrite: Buffer = proxyResult.isBase64Encoded ? Buffer.from(proxyResult.body, 'base64') : Buffer.from(proxyResult.body);

    response.end(toWrite);
    return !!proxyResult.body;
  }
}
