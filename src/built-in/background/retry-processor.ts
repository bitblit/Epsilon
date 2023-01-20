import { DurationRatchet, Logger, PromiseRatchet } from '@bitblit/ratchet/common';
import { BackgroundProcessor } from '../../config/background/background-processor';
import { StringRatchet } from '@bitblit/ratchet/common/string-ratchet';
import { NumberRatchet } from '@bitblit/ratchet/common/number-ratchet';
import { BackgroundManagerLike } from '../../background/manager/background-manager-like';

export class RetryProcessor implements BackgroundProcessor<any> {
  private static readonly RETRY_FIELD_NAME: string = '___RetryProcessorTryNumber';

  constructor(private delegate: BackgroundProcessor<any>, private opts: RetryProcessorOptions) {}

  public get typeName(): string {
    return StringRatchet.trimToEmpty(this.opts?.typePrefix) + this.delegate.typeName + StringRatchet.trimToEmpty(this.opts?.typeSuffix);
  }

  public async handleEvent(data: any, mgr: BackgroundManagerLike): Promise<void> {
    const tryNumber: number =
      data && data[RetryProcessor.RETRY_FIELD_NAME] ? NumberRatchet.safeNumber(data[RetryProcessor.RETRY_FIELD_NAME]) : 1;
    const dataCopy: any = data ? Object.assign({}, data) : null;
    delete dataCopy[RetryProcessor.RETRY_FIELD_NAME];
    Logger.info('RetryProcessor : %s : Try %d of %d', this.delegate.typeName, tryNumber, this.opts.retryCount);
    try {
      await this.delegate.handleEvent(dataCopy, mgr);
    } catch (err) {
      Logger.error('Failed to process : %s', err, err);
      if (tryNumber < this.opts.retryCount) {
        const waitTimeMS: number = tryNumber * this.opts.baseDelayMS;
        Logger.info('Firing automatic retry after a wait of %s', DurationRatchet.formatMsDuration(waitTimeMS));
        await PromiseRatchet.wait(waitTimeMS);
        const wrapped: any = dataCopy || {};
        wrapped[RetryProcessor.RETRY_FIELD_NAME] = tryNumber + 1;
        await mgr.fireImmediateProcessRequestByParts(this.typeName, wrapped);
      } else {
        Logger.error('That was the last try - giving up');
      }
    }
  }
}

export interface RetryProcessorOptions {
  retryCount?: number;
  baseDelayMS?: number;
  typePrefix?: string;
  typeSuffix?: string;
}
