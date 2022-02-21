import { BackgroundAwsConfig } from './background-aws-config';
import { BackgroundProcessor } from './background-processor';
import { BackgroundS3TransactionLoggingConfig } from './background-s3-transaction-logging-config';
import { BackgroundErrorProcessor } from './background-error-processor';
import { BackgroundHandlerListener } from '../../background/background-handler-listener';

export interface BackgroundConfig {
  aws: BackgroundAwsConfig;
  s3TransactionLoggingConfig?: BackgroundS3TransactionLoggingConfig;
  errorProcessor?: BackgroundErrorProcessor;
  httpStatusEndpoint?: string;
  httpMetaEndpoint?: string;
  httpSubmissionPath: string;
  implyTypeFromPathSuffix: boolean;
  processors: BackgroundProcessor<any>[];
  executionListeners?: BackgroundHandlerListener[];
}
