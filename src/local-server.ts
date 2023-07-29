import { APIGatewayEvent, APIGatewayEventRequestContext, Context, ProxyResult } from 'aws-lambda';
import { Logger } from '@bitblit/ratchet/common';
import http, { IncomingMessage, Server, ServerResponse } from 'http';
import https from 'https';
import { StringRatchet } from '@bitblit/ratchet/common';
import { DateTime } from 'luxon';
import qs from 'querystring';
import { EventUtil } from './http/event-util.js';
import { EpsilonGlobalHandler } from './epsilon-global-handler.js';
import { LoggerLevelName } from '@bitblit/ratchet/common';
import { JwtTokenBase } from '@bitblit/ratchet/common';
import { LocalServerCert } from './local-server-cert.js';
import { SampleServerComponents } from './sample/sample-server-components.js';
import { LocalWebTokenManipulator } from './http/auth/local-web-token-manipulator.js';

/**
 * A simplistic server for testing your lambdas locally
 */
export class LocalServer {
  private server: Server;
  private aborted: boolean = false;

  constructor(private globalHandler: EpsilonGlobalHandler, private port: number = 8888, https: boolean = false) {}

  async runServer(): Promise<boolean> {
    return new Promise<boolean>((res, rej) => {
      try {
        Logger.info('Starting Epsilon server on port %d', this.port);

        if (https) {
          const options = {
            key: LocalServerCert.CLIENT_KEY_PEM,
            cert: LocalServerCert.CLIENT_CERT_PEM,
          };
          Logger.info(
              'Starting https server - THIS SERVER IS NOT SECURE!  The KEYS are in the code!  Testing Server Only - Use at your own risk!'
          );
          this.server = https.createServer(options, this.requestHandler.bind(this)).listen(this.port);
        } else {
          this.server = http.createServer(this.requestHandler.bind(this)).listen(this.port);
        }
        Logger.info('Epsilon server is listening');

        // Also listen for SIGINT
        process.on('SIGINT', () => {
          Logger.info('Caught SIGINT - shutting down test server...');
          this.aborted = true;
          res(true);
        });
      } catch (err) {
        Logger.error('Local server failed : %s', err, err);
        rej(err);
      }
    });
  }

  async requestHandler(request: IncomingMessage, response: ServerResponse): Promise<any> {
    const context: Context = {
      awsRequestId: 'LOCAL-' + StringRatchet.createType4Guid(),
      getRemainingTimeInMillis(): number {
        return 300000;
      },
    } as Context; //TBD
    const evt: APIGatewayEvent = await LocalServer.messageToApiGatewayEvent(request, context);
    const logEventLevel: LoggerLevelName = EventUtil.eventIsAGraphQLIntrospection(evt) ? LoggerLevelName.silly : LoggerLevelName.info;

    if (evt.path == '/epsilon-poison-pill') {
      this.aborted = true;
      return true;
    } else {
      const result: ProxyResult = await this.globalHandler.lambdaHandler(evt, context);
      const written: boolean = await LocalServer.writeProxyResultToServerResponse(result, response);
      return written;
    }
  }

  public static async bodyAsBase64String(request: IncomingMessage): Promise<string> {
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

  public static async messageToApiGatewayEvent(request: IncomingMessage, context: Context): Promise<APIGatewayEvent> {
    const bodyString: string = await LocalServer.bodyAsBase64String(request);
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

  public static async writeProxyResultToServerResponse(proxyResult: ProxyResult, response: ServerResponse): Promise<boolean> {
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
    if (proxyResult.multiValueHeaders) {
      Object.keys(proxyResult.multiValueHeaders).forEach((hk) => {
        response.setHeader(hk, proxyResult.multiValueHeaders[hk].join(','));
      });
    }
    const toWrite: Buffer = proxyResult.isBase64Encoded ? Buffer.from(proxyResult.body, 'base64') : Buffer.from(proxyResult.body);

    response.end(toWrite);
    return !!proxyResult.body;
  }

  public static async runSampleBatchOnlyServerFromCliArgs(args: string[]): Promise<void> {
    Logger.setLevel(LoggerLevelName.debug);
    const handler: EpsilonGlobalHandler = await SampleServerComponents.createSampleBatchOnlyEpsilonGlobalHandler(
        'SampleBatchOnlyLocalServer-' + Date.now()
    );
    const testServer: LocalServer = new LocalServer(handler);
    const res: boolean = await testServer.runServer();
    Logger.info('Res was : %s', res);
  }

  public static async runSampleLocalServerFromCliArgs(args: string[]): Promise<void> {
    Logger.setLevel(LoggerLevelName.debug);
    const localTokenHandler: LocalWebTokenManipulator<JwtTokenBase> = new LocalWebTokenManipulator<JwtTokenBase>(
        ['abcd1234'],
        'sample-server'
    );
    const token: string = await localTokenHandler.createJWTStringAsync('asdf', {}, ['USER'], 3600);

    Logger.info('Use token: %s', token);
    const handler: EpsilonGlobalHandler = await SampleServerComponents.createSampleEpsilonGlobalHandler('SampleLocalServer-' + Date.now());
    const testServer: LocalServer = new LocalServer(handler, 8888, true);
    const res: boolean = await testServer.runServer();
    Logger.info('Res was : %s', res);
  }
}
