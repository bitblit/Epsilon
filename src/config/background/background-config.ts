import { BackgroundAwsConfig } from './background-aws-config';
import { BackgroundProcessor } from '../background-processor';

export interface BackgroundConfig {
  aws: BackgroundAwsConfig;
  backgroundHttpEndpointPrefix: string;
  backgroundHttpEndpointAuthorizerName?: string;
  processors: BackgroundProcessor<any>[];
}
