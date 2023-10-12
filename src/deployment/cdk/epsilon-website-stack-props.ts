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

// NOTE: This is a psuedo-enum to fix some issues with Typescript enums.  See: https://exploringjs.com/tackling-ts/ch_enum-alternatives.html for details

export const EpsilonWebsiteStackPropsRoute53Handling = {
  Update: 'Update',
  DoNotUpdate: 'DoNotUpdate',
};
export type EpsilonWebsiteStackPropsRoute53Handling =
  (typeof EpsilonWebsiteStackPropsRoute53Handling)[keyof typeof EpsilonWebsiteStackPropsRoute53Handling];
