import { BackgroundAwsConfig } from './background-aws-config';
import { BackgroundProcessor } from './background-processor';

export interface BackgroundConfig {
  aws: BackgroundAwsConfig;
  processors: BackgroundProcessor<any, any>[];
}
