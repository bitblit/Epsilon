import { SaltMineEntry } from '../salt-mine-entry';
import { Logger, PromiseRatchet } from '@bitblit/ratchet/dist/common';

export class SampleDelayProcessor {
  public async handler(entry: SaltMineEntry): Promise<void> {
    const delayMS: number = Math.floor(Math.random() * 1500);
    Logger.info('Running sample processor for %d', delayMS);
    await PromiseRatchet.wait(delayMS);
    Logger.info('Sample processor complete');
  }
}
