import { StackProps } from 'aws-cdk-lib';

export interface EpsilonWebsiteStackProps extends StackProps {
  targetBucketName: string;
  cloudFrontHttpsCertificateArn: string;
  cloudFrontDomainNames: string[];
  apiDomainName: string;
}
