import { CronConfig } from '../background/cron/cron-config';
import { DynamoDbConfig } from '../non-http/dynamo-db-config';
import { S3Config } from '../non-http/s3-config';
import { SnsConfig } from '../non-http/sns-config';
import { EpsilonDisableSwitches } from './epsilon-disable-switches';
import { EpsilonLoggerConfig } from './epsilon-logger-config';
import { HttpConfig } from '../http/route/http-config';
import { BackgroundConfig } from '../background/background-config';

export interface EpsilonConfig {
  openApiYamlString: string;
  httpConfig?: HttpConfig;

  backgroundConfig?: BackgroundConfig;

  cron?: CronConfig;
  dynamoDb?: DynamoDbConfig;
  s3?: S3Config;
  sns?: SnsConfig;

  disabled?: EpsilonDisableSwitches;
  loggerConfig?: EpsilonLoggerConfig;
}
