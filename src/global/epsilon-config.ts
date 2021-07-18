import { EpsilonRouter } from '../http/route/epsilon-router';
import { CronConfig } from '../batch/cron/cron-config';
import { DynamoDbConfig } from '../batch/dynamo-db-config';
import { S3Config } from '../batch/s3-config';
import { SnsConfig } from '../batch/sns-config';
import { EpsilonDisableSwitches } from './epsilon-disable-switches';
import { EpsilonLoggerConfig } from './epsilon-logger-config';
import { HttpConfig } from '../http/route/http-config';
import { SaltMineConfig } from '../salt-mine/salt-mine-config';

export interface EpsilonConfig {
  openApiYamlString: string;
  httpConfig: HttpConfig;

  saltMineConfig: SaltMineConfig;

  cron?: CronConfig;
  dynamoDb?: DynamoDbConfig;
  s3?: S3Config;
  sns?: SnsConfig;

  disabled?: EpsilonDisableSwitches;
  loggerConfig?: EpsilonLoggerConfig;
}
