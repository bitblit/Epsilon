import { StackProps } from 'aws-cdk-lib';
import { SimpleAdditionalS3WebsiteMapping } from './simple-additional-s3-website-mapping';

export interface EpsilonWebsiteStackProps extends StackProps {
  targetBucketName: string;
  cloudFrontHttpsCertificateArn: string;
  cloudFrontDomainNames: string[];
  apiDomainName: string;
  pathsToAssets: string[];
  route53Handling: EpsilonWebsiteStackPropsRoute53Handling;
  simpleAdditionalMappings?: SimpleAdditionalS3WebsiteMapping[];
}

export enum EpsilonWebsiteStackPropsRoute53Handling {
  Update = 'Update',
  DoNotUpdate = 'DoNotUpdate',
}
