import { StackProps } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

export interface EpsilonWebsiteStackProps extends StackProps {
  targetBucketName: string;
  cloudFrontHttpsCertificateArn: string;
  cloudFrontDomainName: string;
  apiDomainName: string;
}
