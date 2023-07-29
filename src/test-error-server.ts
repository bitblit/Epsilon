import { Logger } from '@bitblit/ratchet/common/logger';
import { CliRatchet } from '@bitblit/ratchet/node-only';
import { IncomingMessage, Server, ServerResponse } from 'http';
import net from 'net';

/**
 * A simplistic server for testing your lambdas locally
 */
export class TestErrorServer {
  private server: Server;
  private aborted: boolean = false;

  constructor(private port: number = 9999) {}

  async runServer(): Promise<boolean> {
    Logger.info('Starting Test Error net server on port %d', this.port);

    return new Promise<boolean>((res, rej) => {
      const server = new net.Server({});
      // The server listens to a socket for a client to make a connection request.
      // Think of a socket as an end point.
      server.listen(this.port, () => {
        Logger.info('Server listening for connection requests on socket localhost: %s', this.port);
      });

      // When a client requests a connection with the server, the server creates a new
      // socket dedicated to that client.
      server.on('connection', async (socket) => {
        Logger.info('X: A new connection has been established.');

        //await PromiseRatchet.wait(30000);
        // Now that a TCP connection has been established, the server can send data to
        // the client by writing to its socket.
        socket.write('Hello, client.');

        // The server can also receive data from the client by reading from its socket.
        socket.on('data', (chunk) => {
          Logger.info('Data received from client: %s', chunk);
        });

        // When the client requests to end the TCP connection with the server, the server
        // ends the connection.
        socket.on('end', () => {
          Logger.info('Closing connection with the client');
        });

        // Don't forget to catch error, for your own sake.
        socket.on('error', (err) => {
          Logger.info('Error: %s', err);
        });
      });

      /*
      this.server = http.createServer(this.requestHandler.bind(this)).listen(this.port);
      Logger.info('Test Error server is listening');

      // Also listen for SIGINT
      process.on('SIGINT', () => {
        Logger.info('Caught SIGINT - shutting down test server...');
        this.aborted = true;
      });

      return this.checkFinished();

       */
    });
  }

  async requestHandler(request: IncomingMessage, response: ServerResponse): Promise<any> {
    Logger.info('Got request %d - closing socket', request);
    request.setTimeout(100);
    //await PromiseRatchet.wait(3000);
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
    const logEventLevel: LoggerLevelName = EventUtil.eventIsAGraphQLIntrospection(evt) ? LoggerLevelName.silly : LoggerLevelName.info;

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

if (CliRatchet.isCalledFromCLISingle('test-error-server')) {
  const testServer: TestErrorServer = new TestErrorServer();
  testServer.runServer().then((res) => {
    Logger.info('Got res server');
    process.exit(0);
  });
}
