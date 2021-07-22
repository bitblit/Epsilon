import { Logger, PromiseRatchet } from '@bitblit/ratchet/dist/common';
import { BackgroundConfig } from '../background-config';
import { BackgroundProcessor } from '../background-processor';
import { BackgroundManager } from '../background-manager';

export class SampleDelayProcessor implements BackgroundProcessor<any, any> {
  public get typeName(): string {
    return 'BackgroundBuiltInSampleDelayProcessor';
  }

  public async handleEvent(data: any, metaData: any, mgr?: BackgroundManager): Promise<void> {
    const delayMS: number = Math.floor(Math.random() * 5000);
    Logger.info('Running sample processor for %d', delayMS);
    await PromiseRatchet.wait(delayMS);
    Logger.info('Sample processor complete');
  }
}
