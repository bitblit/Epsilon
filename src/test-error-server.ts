import { Logger } from '@bitblit/ratchet/dist/common/logger';
import http, { IncomingMessage, Server, ServerResponse } from 'http';
import { PromiseRatchet } from '@bitblit/ratchet/dist/common/promise-ratchet';

/**
 * A simplistic server for testing your lambdas locally
 */
export class TestErrorServer {
  private server: Server;
  private aborted: boolean = false;

  constructor(private port: number = 9999) {}

  async runServer(): Promise<boolean> {
    Logger.info('Starting Test Error server on port %d', this.port);
    this.server = http.createServer(this.requestHandler.bind(this)).listen(this.port);
    Logger.info('Test Error server is listening');

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
    Logger.info('Got request %j - closing socket', request);
    await PromiseRatchet.wait(3000);
    response.end('x');
    /*response.socket.end(() => {
      //return null;
    });

     */
    /*(e) => {
      Logger.info('Out: %s', e);
    });

     */
    /*const context: Context = {
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
      const result: ProxyResult = await this.globalHandler.lambdaHandler(evt, context);
      const written: boolean = await this.writeProxyResultToServerResponse(result, response);
      return written;
    }

     */
  }

  /*
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
    if (proxyResult.multiValueHeaders) {
      Object.keys(proxyResult.multiValueHeaders).forEach((hk) => {
        response.setHeader(hk, proxyResult.multiValueHeaders[hk].join(','));
      });
    }
    const toWrite: Buffer = proxyResult.isBase64Encoded ? Buffer.from(proxyResult.body, 'base64') : Buffer.from(proxyResult.body);

    response.end(toWrite);
    return !!proxyResult.body;
  }

   */
}

/*
const testServer: TestErrorServer = new TestErrorServer();
testServer.runServer().then((res) => {
  Logger.info('Got res server');
  process.exit(0);
});

 */
