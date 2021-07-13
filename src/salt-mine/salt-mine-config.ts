import { SaltMineAwsConfig } from './salt-mine-aws-config';
import { SaltMineDevelopmentServerConfig } from './salt-mine-development-server-config';
import { SaltMineProcessConfig } from './salt-mine-process-config';

export interface SaltMineConfig {
  aws: SaltMineAwsConfig;
  development: SaltMineDevelopmentServerConfig;
  processes: Record<string, SaltMineProcessConfig>;
}
