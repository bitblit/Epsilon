import { StackProps } from 'aws-cdk-lib';

export interface EpsilonWebsiteStackProps extends StackProps {
  targetBucketName: string;
  cloudFrontHttpsCertificateArn: string;
  cloudFrontDomainNames: string[];
  apiDomainName: string;
  pathsToAssets: string[];
  route53Handling: EpsilonWebsiteStackPropsRoute53Handling;
}

export enum EpsilonWebsiteStackPropsRoute53Handling {
  Update = 'Update',
  DoNotUpdate = 'DoNotUpdate',
}
