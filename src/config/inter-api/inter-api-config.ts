import { InterApiAwsConfig } from './inter-api-aws-config';
import { InterApiProcessMapping } from './inter-api-process-mapping';

export interface InterApiConfig {
  aws: InterApiAwsConfig;
  processMappings: InterApiProcessMapping[];
}
