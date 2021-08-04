import { Logger } from '@bitblit/ratchet/dist/common';
import { BackgroundEntry } from './background-entry';
import { Context } from 'aws-lambda';
import { BackgroundProcessor } from './background-processor';
import { BackgroundManager } from './background-manager';
import { ExtendedAPIGatewayEvent } from '../http/route/extended-api-gateway-event';
import { BooleanRatchet } from '@bitblit/ratchet/dist/common/boolean-ratchet';
import { BackgroundQueueResponseInternal } from './background-queue-response-internal';
import { BackgroundProcessHandling } from './background-process-handling';
import { BackgroundConfig } from './background-config';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';

/**
 * We use a FIFO queue so that 2 different Lambdas don't both work on the same
 * thing at the same time.
 */
export class BackgroundHttpAdapterHandler {
  constructor(private backgroundConfig: BackgroundConfig, private backgroundManager: BackgroundManager) {}

  public get backgroundHttpEndpointPrefix(): string {
    return this.backgroundConfig.backgroundHttpEndpointPrefix;
  }

  public get backgroundHttpEndpointAuthorizerName(): string {
    return this.backgroundConfig.backgroundHttpEndpointAuthorizerName;
  }

  public async handleBackgroundSubmission(evt: ExtendedAPIGatewayEvent, context: Context): Promise<BackgroundQueueResponseInternal> {
    Logger.info('handleBackgroundSubmission : %j (local:%s)', evt.parsedBody, this.backgroundManager.localMode);

    let rval: BackgroundQueueResponseInternal = null;

    const startIdx: number = evt.path.indexOf(this.backgroundHttpEndpointPrefix) + this.backgroundHttpEndpointPrefix.length;
    let testPath: string = evt.path.substring(startIdx).split('-').join('').toLowerCase();
    if (testPath.includes('?')) {
      testPath = testPath.substring(0, testPath.indexOf('?'));
    }
    const foundProc: BackgroundProcessor<any> = this.backgroundConfig.processors.find((s) => s.typeName.toLowerCase() === testPath);
    const immediate: boolean = BooleanRatchet.parseBool(evt.queryStringParameters['immediate']);
    const startProcessor: boolean = BooleanRatchet.parseBool(evt.queryStringParameters['startProcessor']);

    if (foundProc) {
      const data: any = evt.parsedBody;

      const entry: BackgroundEntry = {
        type: foundProc.typeName,
        data: data,
        created: new Date().getTime(),
      };

      let result: string = null;
      if (immediate) {
        result = await this.backgroundManager.fireImmediateProcessRequest(entry);
      } else {
        result = await this.backgroundManager.addEntryToQueue(entry, startProcessor);
      }

      rval = {
        processHandling: immediate ? BackgroundProcessHandling.Immediate : BackgroundProcessHandling.Queued,
        startProcessorRequested: startProcessor,
        success: true,
        resultId: result,
        error: null,
      };
    } else {
      Logger.error('Could not find target background processor : %s', testPath);
      rval = {
        processHandling: immediate ? BackgroundProcessHandling.Immediate : BackgroundProcessHandling.Queued,
        startProcessorRequested: startProcessor,
        success: false,
        resultId: null,
        error: 'Processor not found',
      };
    }

    return rval;
  }
}
