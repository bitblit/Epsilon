import { Logger } from '@bitblit/ratchet/dist/common';
import { SaltMineEntry } from '../salt-mine-entry';

export class EchoProcessor {
  public async handler(entry: SaltMineEntry): Promise<boolean> {
    Logger.info('Echo processing : %j', entry);
    return true;
  }
}
