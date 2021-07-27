import { Logger } from '@bitblit/ratchet/dist/common';
import { BackgroundEntry } from './background-entry';
import { Context } from 'aws-lambda';
import { BackgroundProcessor } from './background-processor';
import { BackgroundManager } from './background-manager';
import { BackgroundValidator } from './background-validator';
import { ExtendedAPIGatewayEvent } from '../http/route/extended-api-gateway-event';
import { BooleanRatchet } from '@bitblit/ratchet/dist/common/boolean-ratchet';
import { BadRequestError } from '../http/error/bad-request-error';
import { BackgroundQueueResponseInternal } from './background-queue-response-internal';
import { BackgroundProcessHandling } from './background-process-handling';
import { BackgroundConfig } from './background-config';

/**
 * We use a FIFO queue so that 2 different Lambdas don't both work on the same
 * thing at the same time.
 */
export class BackgroundHttpAdapterHandler {
  private backgroundManager: BackgroundManager;

  constructor(private backgroundConfig: BackgroundConfig) {
    this.backgroundManager = new BackgroundManager(this.backgroundConfig.aws, true);
  }

  public get backgroundHttpEndpointPrefix(): string {
    return this.backgroundConfig.backgroundHttpEndpointPrefix;
  }

  public get backgroundHttpEndpointAuthorizerName(): string {
    return this.backgroundConfig.backgroundHttpEndpointAuthorizerName;
  }

  public async handleBackgroundSubmission(evt: ExtendedAPIGatewayEvent, context: Context): Promise<BackgroundQueueResponseInternal> {
    Logger.info('handleBackgroundSubmission : %j', evt.body);

    const typeField: string = 'xxx'; // TODO: Extract from request
    const data: any = evt.parsedBody;
    const immediate: boolean = BooleanRatchet.parseBool(evt.queryStringParameters['immediate']);
    const startProcessor: boolean = BooleanRatchet.parseBool(evt.queryStringParameters['startProcessor']);

    if (!typeField) {
      throw new BadRequestError('Cannot submit entry with no type field');
    }

    const entry: BackgroundEntry = {
      type: typeField,
      data: data,
      created: new Date().getTime(),
    };

    let result: string = null;
    if (immediate) {
      result = await this.backgroundManager.fireImmediateProcessRequest(entry);
    } else {
      result = await this.backgroundManager.addEntryToQueue(entry, startProcessor);
    }

    const rval: BackgroundQueueResponseInternal = {
      processHandling: immediate ? BackgroundProcessHandling.Immediate : BackgroundProcessHandling.Queued,
      startProcessorRequested: startProcessor,
      success: true,
      resultId: result,
    };

    return rval;
  }
}
