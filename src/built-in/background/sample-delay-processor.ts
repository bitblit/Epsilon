import { Logger, PromiseRatchet } from '@bitblit/ratchet/common';
import { BackgroundProcessor } from '../../config/background/background-processor';
import { BackgroundManagerLike } from '../../background/manager/background-manager-like';

export class SampleDelayProcessor implements BackgroundProcessor<any> {
  public get typeName(): string {
    return 'EpsilonSampleDelay';
  }

  public async handleEvent(data: any, mgr?: BackgroundManagerLike): Promise<void> {
    const delayMS: number = Math.floor(Math.random() * 5000);
    Logger.info('Running sample processor for %d', delayMS);
    await PromiseRatchet.wait(delayMS);
    Logger.info('Sample processor complete');
  }
}
