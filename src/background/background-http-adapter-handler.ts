import { Logger } from '@bitblit/ratchet/dist/common';
import { BackgroundEntry } from './background-entry';
import { Context } from 'aws-lambda';
import { ExtendedAPIGatewayEvent } from '../http/route/extended-api-gateway-event';
import { BooleanRatchet } from '@bitblit/ratchet/dist/common/boolean-ratchet';
import { BackgroundQueueResponseInternal } from './background-queue-response-internal';
import { BackgroundProcessHandling } from './background-process-handling';
import { BackgroundConfig } from '../config/background/background-config';
import { BackgroundManager } from '../background-manager';
import { ModelValidator } from '@bitblit/ratchet/dist/model-validator';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import { BadRequestError } from '../http/error/bad-request-error';
import { InternalBackgroundEntry } from './internal-background-entry';
import { BackgroundProcessor } from '../config/background/background-processor';

/**
 * We use a FIFO queue so that 2 different Lambdas don't both work on the same
 * thing at the same time.
 */
export class BackgroundHttpAdapterHandler {
  constructor(
    private backgroundConfig: BackgroundConfig,
    private modelValidator: ModelValidator,
    private backgroundManager: BackgroundManager
  ) {}

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
    let pathSuppliedBackgroundType: string = evt.path.substring(startIdx).split('-').join('').toLowerCase();
    // Strip any query params or fragments
    if (pathSuppliedBackgroundType.includes('?')) {
      pathSuppliedBackgroundType = pathSuppliedBackgroundType.substring(0, pathSuppliedBackgroundType.indexOf('?'));
    }
    if (pathSuppliedBackgroundType.includes('#')) {
      pathSuppliedBackgroundType = pathSuppliedBackgroundType.substring(0, pathSuppliedBackgroundType.indexOf('#'));
    }

    const entry: BackgroundEntry<any> = evt.parsedBody || {}; // Many background submissions contain no body (pure triggers)

    // So, either this was configured pathed (like xxx/background/{typename} or non-pathed
    // like /xxx/background.  If non-pathed, you must supply the type field in the body.  If
    // pathed, you must either NOT supply the type field in the body, since it'll be determined
    // by the path, or the types must match
    if (StringRatchet.trimToNull(pathSuppliedBackgroundType)) {
      if (StringRatchet.trimToNull(entry?.type) && entry.type.toLocaleLowerCase() !== pathSuppliedBackgroundType.toLocaleLowerCase()) {
        throw new BadRequestError('Background submission has type but does not match path supplied type');
      } else {
        entry.type = pathSuppliedBackgroundType;
      }
    } else {
      // No path, must be in here
      if (!StringRatchet.trimToNull(entry?.type)) {
        throw new BadRequestError('Background submission missing type and not configured in pathed mode');
      }
    }

    const foundProc: BackgroundProcessor<any> = this.backgroundConfig.processors.find(
      (s) => s.typeName.toLowerCase() === entry.type.toLowerCase()
    );
    const immediate: boolean = BooleanRatchet.parseBool(evt.queryStringParameters['immediate']);
    const startProcessor: boolean = BooleanRatchet.parseBool(evt.queryStringParameters['startProcessor']);

    if (foundProc) {
      // Perform a validation (if this is a path-supplied type it probably already happened, but don't hurt to do it again)
      // If you're worried about that, and you do path-typing, just don't have your processors set the dataModelName
      if (StringRatchet.trimToNull(foundProc.dataSchemaName)) {
        // I'm not allowing empty and extra properties here since this is a fully internally defined object
        const errors: string[] = this.modelValidator.validate(foundProc.dataSchemaName, entry.data, false, false);
        if (errors.length > 0) {
          throw new BadRequestError().withErrors(errors);
        }
      }

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
      throw new BadRequestError().withFormattedErrorMessage('Could not find target background processor : %s', entry.type);
    }

    return rval;
  }
}
