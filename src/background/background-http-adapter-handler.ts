import { Logger, StopWatch } from '@bitblit/ratchet/dist/common';
import { BackgroundEntry } from './background-entry';
import { Context } from 'aws-lambda';
import { ExtendedAPIGatewayEvent } from '../config/http/extended-api-gateway-event';
import { BooleanRatchet } from '@bitblit/ratchet/dist/common/boolean-ratchet';
import { BackgroundQueueResponseInternal } from './background-queue-response-internal';
import { BackgroundProcessHandling } from './background-process-handling';
import { BackgroundConfig } from '../config/background/background-config';
import { BackgroundManager } from '../background-manager';
import { ModelValidator } from '@bitblit/ratchet/dist/model-validator';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import { BadRequestError } from '../http/error/bad-request-error';
import { BackgroundProcessor } from '../config/background/background-processor';
import { BackgroundMetaResponseInternal } from './background-meta-response-internal';
import { S3CacheRatchet } from '@bitblit/ratchet/dist/aws';
import { BackgroundTransactionLog } from '../config/background/background-transaction-log';
import { NotFoundError } from '../http/error/not-found-error';
import { PromiseRatchet } from '@bitblit/ratchet/dist/common/promise-ratchet';

/**
 * We use a FIFO queue so that 2 different Lambdas don't both work on the same
 * thing at the same time.
 */
export class BackgroundHttpAdapterHandler {
  private s3TransactionLogCacheRatchet: S3CacheRatchet;

  constructor(
    private backgroundConfig: BackgroundConfig,
    private modelValidator: ModelValidator,
    private backgroundManager: BackgroundManager,
    private maxWaitInMsForBackgroundJobToStart: number = 10_000
  ) {
    if (this?.backgroundConfig?.s3TransactionLoggingConfig?.s3 && this?.backgroundConfig?.s3TransactionLoggingConfig?.bucket) {
      this.s3TransactionLogCacheRatchet = new S3CacheRatchet(
        this.backgroundConfig.s3TransactionLoggingConfig.s3,
        this.backgroundConfig.s3TransactionLoggingConfig.bucket
      );
    }
  }

  public get httpMetaEndpoint(): string {
    return this.backgroundConfig.httpMetaEndpoint;
  }

  public get httpSubmissionPath(): string {
    return this.backgroundConfig.httpSubmissionPath;
  }

  public get httpStatusPath(): string {
    return this.backgroundConfig.httpStatusEndpoint;
  }

  public get implyTypeFromPathSuffix(): boolean {
    return this.backgroundConfig.implyTypeFromPathSuffix;
  }

  public async handleBackgroundStatusRequest(evt: ExtendedAPIGatewayEvent, context: Context): Promise<BackgroundTransactionLog> {
    Logger.info('handleBackgroundStatusRequest called');
    if (!this.s3TransactionLogCacheRatchet) {
      throw new BadRequestError('Process logging not enabled');
    } else {
      const guid: string =
        StringRatchet.trimToNull(evt.pathParameters['guid']) || StringRatchet.trimToNull(evt.queryStringParameters['guid']);
      if (guid) {
        const path: string = BackgroundManager.backgroundGuidToPath(this.backgroundConfig.s3TransactionLoggingConfig.prefix, guid);
        const sw: StopWatch = new StopWatch(true);
        let log: BackgroundTransactionLog = null;
        while (!log && sw.elapsedMS() < this.maxWaitInMsForBackgroundJobToStart) {
          log = await this.s3TransactionLogCacheRatchet.readCacheFileToObject<BackgroundTransactionLog>(path);
          if (!log) {
            Logger.debug(
              'No log found yet, waiting 500 ms and retrying (%s of %d waited so far)',
              sw.dump(),
              this.maxWaitInMsForBackgroundJobToStart
            );
            await PromiseRatchet.wait(500);
          }
        }

        if (!log) {
          throw new NotFoundError().withFormattedErrorMessage('No background result found for guid %s', guid);
        }
        return log;
      } else {
        throw new BadRequestError('No guid specified');
      }
    }
  }

  public async handleBackgroundMetaRequest(evt: ExtendedAPIGatewayEvent, context: Context): Promise<BackgroundMetaResponseInternal> {
    Logger.info('handleBackgroundMetaRequest called');
    const currentCount: number = await this.backgroundManager.fetchApproximateNumberOfQueueEntries();
    const valid: string[] = this.backgroundConfig.processors.map((b) => b.typeName).filter((a) => !!a);
    valid.sort((a, b) => a.localeCompare(b));
    const rval: BackgroundMetaResponseInternal = {
      currentQueueLength: currentCount,
      validTypes: valid,
      localMode: this.backgroundManager.localMode,
    };
    return rval;
  }

  public async handleBackgroundSubmission(evt: ExtendedAPIGatewayEvent, context: Context): Promise<BackgroundQueueResponseInternal> {
    Logger.info('handleBackgroundSubmission : %j (local:%s)', evt.parsedBody, this.backgroundManager.localMode);

    let rval: BackgroundQueueResponseInternal = null;

    const startIdx: number = evt.path.indexOf(this.httpSubmissionPath) + this.httpSubmissionPath.length;
    let pathSuppliedBackgroundType: string = this.backgroundConfig.implyTypeFromPathSuffix
      ? evt.path.substring(startIdx).split('-').join('').toLowerCase()
      : '';
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
