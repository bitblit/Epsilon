import {APIGatewayEvent, Context, ProxyResult} from 'aws-lambda';
import {Logger, LoggerLevelName, StringRatchet} from '@bitblit/ratchet/common';
import http, {IncomingMessage, Server, ServerResponse} from 'http';
import {EventUtil} from './http/event-util';
import fetch from 'cross-fetch';
import {LocalServer} from './local-server';

/**
 * A simplistic server for testing your lambdas locally
 */
export class LocalContainerServer {
  private server: Server;
  private aborted: boolean = false;

  constructor(private port: number = 8889) {}

  public async runServer(): Promise<boolean> {
    return new Promise<boolean>((res, rej) => {
      try {
        Logger.info('Starting Epsilon server on port %d', this.port);
        this.server = http.createServer(this.requestHandler.bind(this)).listen(this.port);
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

    Logger.logByLevel(logEventLevel, 'Processing event: %j', evt);

    if (evt.path == '/epsilon-poison-pill') {
      this.aborted = true;
      return true;
    } else {
      const url: string = 'http://localhost:8080/2015-03-31/functions/function/invocations';
      try {
        const postResp: Response = await fetch(url, { method: 'POST', body: JSON.stringify(evt) });
        const respBody: any = await postResp.json();
        const result: ProxyResult = respBody;
        const written: boolean = await LocalServer.writeProxyResultToServerResponse(result, response, LoggerLevelName.debug);
        return written;
      } catch (err) {
        Logger.error('Failed: %s', err);
        return '{"bad":true}';
      }
    }
  }

  public static async runFromCliArgs(args: string[]): Promise<void> {
    try {
      Logger.setLevel(LoggerLevelName.debug);
      Logger.debug('Running local container server : %j', process?.argv);
      const testServer: LocalContainerServer = new LocalContainerServer();
      await testServer.runServer();
      Logger.info('Got res server');
      process.exit(0);
    } catch (err) {
      Logger.error('Error : %s', err);
      process.exit(1);
    }
  }
}
