import { RouterConfig } from '../http/route/router-config';
import { CronConfig } from '../batch/cron/cron-config';
import { DynamoDbConfig } from '../batch/dynamo-db-config';
import { S3Config } from '../batch/s3-config';
import { SnsConfig } from '../batch/sns-config';
import { EpsilonDisableSwitches } from './epsilon-disable-switches';
import { EpsilonLoggerConfig } from './epsilon-logger-config';
import { SaltMineHandler } from '../salt-mine';

export interface EpsilonConfig {
  http: RouterConfig;

  saltMine: SaltMineHandler;

  cron: CronConfig;
  dynamoDb: DynamoDbConfig;
  s3: S3Config;
  sns: SnsConfig;

  disabled: EpsilonDisableSwitches;
  loggerConfig: EpsilonLoggerConfig;
}
