import { Logger, PromiseRatchet } from '@bitblit/ratchet/dist/common';
import { SaltMineConfig } from '../salt-mine-config';
import { SaltMineNamedProcessor } from '../salt-mine-named-processor';

export class SampleDelayProcessor implements SaltMineNamedProcessor<any, any> {
  public get typeName(): string {
    return 'SaltMineBuiltInSampleDelayProcessor';
  }

  public async handleEvent(data: any, metaData: any, cfg?: SaltMineConfig): Promise<void> {
    const delayMS: number = Math.floor(Math.random() * 5000);
    Logger.info('Running sample processor for %d', delayMS);
    await PromiseRatchet.wait(delayMS);
    Logger.info('Sample processor complete');
  }
}
