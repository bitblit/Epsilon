import { SaltMineAwsConfig } from './salt-mine-aws-config';
import { SaltMineDevelopmentServerConfig } from './salt-mine-development-server-config';
import { SaltMineNamedProcessor } from './salt-mine-named-processor';

export interface SaltMineConfig {
  aws: SaltMineAwsConfig;
  development: SaltMineDevelopmentServerConfig;
  processors: SaltMineNamedProcessor<any, any>[];
}
