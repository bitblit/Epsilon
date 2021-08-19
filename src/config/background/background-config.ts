import { BackgroundAwsConfig } from './background-aws-config';
import { BackgroundProcessor } from './background-processor';

export interface BackgroundConfig {
  aws: BackgroundAwsConfig;
  httpMetaEndpoint?: string;
  httpSubmissionPath: string;
  implyTypeFromPathSuffix: boolean;
  processors: BackgroundProcessor<any>[];
}
