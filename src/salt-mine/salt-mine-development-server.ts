import { Logger, PromiseRatchet } from '@bitblit/ratchet/dist/common';
import http from 'http';
import { IncomingMessage, Server, ServerResponse } from 'http';
import { SaltMineLocalSimulationEntry } from './salt-mine-local-simulation-entry';
import { SaltMineConfig } from './salt-mine-config';
import { SaltMineProcessor } from './salt-mine-processor';
import { SaltMineHandler } from './salt-mine-handler';
import { SaltMineProcessConfig } from './salt-mine-process-config';

/**
 * A simplistic server for testing your lambdas locally
 */
export class SaltMineDevelopmentServer {
  private server: Server;
  private aborted: boolean = false;
  private saltMineHandler: SaltMineHandler;

  constructor(
    private processors: Map<string, SaltMineProcessor | SaltMineProcessor[]>,
    private port: number = 8124,
    private queueDelay: number = 500
  ) {
    // Create a default non-validated form here
    const procDef: Record<string, SaltMineProcessConfig> = {};
    Array.from(processors.keys()).forEach((key) => {
      const next: SaltMineProcessConfig = {
        description: 'Default config for ' + key,
        schema: null,
      };
      procDef[key] = next;
    });

    const cfg: SaltMineConfig = {
      processes: procDef,
      development: {
        url: 'http://localhost:' + port,
        queueDelayMS: queueDelay,
      },
      aws: null,
    };

    this.saltMineHandler = new SaltMineHandler(cfg, processors);
  }

  async runServer(): Promise<boolean> {
    Logger.info('Starting Salt-Mine simulation server on port %d', this.port);
    this.server = http.createServer(this.requestHandler.bind(this)).listen(this.port);
    Logger.info('Salt-Mine simulation server is listening');

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

  async requestHandler(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.url.includes('/salt-mine-poison-pill')) {
      this.aborted = true;
    } else {
      const evt: SaltMineLocalSimulationEntry = await this.messageToSaltMineLocalSimulationEntry(request);
      if (evt) {
        Logger.info('Processing local simulation entry : %j', evt);
        if (evt.delayMS) {
          Logger.debug('Executing simlation delay of %s', evt.delayMS);
          await PromiseRatchet.wait(evt.delayMS);
        }
        Logger.debug('Starting process');
        let success: boolean = true;
        try {
          await this.saltMineHandler.processSingleSaltMineEntry(evt.entry);
        } catch (err) {
          Logger.error('Failure in salt mine handler : %s', err);
          success = false;
        }
        Logger.debug('Process complete');
        await this.writeServerResponse(success, response);
      } else {
        Logger.info('Unprocessable - returning 500');
        await this.writeServerResponse(false, response);
      }
    }
  }

  private async bodyAsString(request: IncomingMessage): Promise<string> {
    return new Promise<string>((res, rej) => {
      const body = [];
      request.on('data', (chunk) => {
        body.push(chunk);
      });
      request.on('end', () => {
        const rval: string = Buffer.concat(body).toString();
        res(rval);
      });
    });
  }

  private async messageToSaltMineLocalSimulationEntry(request: IncomingMessage): Promise<SaltMineLocalSimulationEntry> {
    const bodyString: string = await this.bodyAsString(request);
    let rval: SaltMineLocalSimulationEntry = null;
    try {
      rval = JSON.parse(bodyString);
      if (!rval || !rval.entry || !rval.entry.type) {
        Logger.error('Invalid body supplied, returning null : %s', bodyString);
        rval = null;
      }
    } catch (err) {
      Logger.error('Unable to parse body : %s : %s', bodyString, err);
      rval = null;
    }
    return rval;
  }

  private async writeServerResponse(success: boolean, response: ServerResponse): Promise<void> {
    response.statusCode = success ? 200 : 500;
    const output: string = success ? 'OK' : 'ERROR';
    response.end(output);
  }
}
