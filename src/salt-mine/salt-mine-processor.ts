import { SaltMineEntry } from './salt-mine-entry';
import { SaltMineConfig } from './salt-mine-config';

// Returns void since you can't use the result anyway
export interface SaltMineProcessor {
  (event: SaltMineEntry, cfg: SaltMineConfig): Promise<void>;
}
