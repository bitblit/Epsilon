import { HttpConfig } from './http/http-config';
import { BackgroundConfig } from './background/background-config';
import { CronConfig } from './cron/cron-config';
import { DynamoDbConfig } from './dynamo-db-config';
import { S3Config } from './s3-config';
import { SnsConfig } from './sns-config';
import { EpsilonLoggerConfig } from './epsilon-logger-config';

export interface EpsilonConfig {
  // If disabled, last resort timeout will instead roll to lambda (not recommended)
  disableLastResortTimeout?: boolean;

  openApiYamlString: string;
  httpConfig?: HttpConfig;

  backgroundConfig?: BackgroundConfig;

  cron?: CronConfig;
  dynamoDb?: DynamoDbConfig;
  s3?: S3Config;
  sns?: SnsConfig;

  loggerConfig?: EpsilonLoggerConfig;
}
