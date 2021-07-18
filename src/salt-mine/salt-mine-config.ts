import { SaltMineAwsConfig } from './salt-mine-aws-config';
import { SaltMineNamedProcessor } from './salt-mine-named-processor';

export interface SaltMineConfig {
  aws: SaltMineAwsConfig;
  processors: SaltMineNamedProcessor<any, any>[];
}
