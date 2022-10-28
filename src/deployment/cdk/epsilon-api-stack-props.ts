import { StackProps } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

export interface EpsilonApiStackProps extends StackProps {
  batchInstancesEc2KeyPairName?: string;
  additionalPolicyStatements: PolicyStatement[];

  dockerFileFolder: string;
  dockerFileName: string;

  lambdaSecurityGroupIds: string[];
  vpcSubnetIds: string[];
  vpcId: string;

  extraEnvironmentalVars?: Record<string, string>;
  webLambdaPingMinutes?: number;

  webMemorySizeMb?: number;
  backgroundMemorySizeMb?: number;

  webTimeoutSeconds?: number;
  backgroundTimeoutSeconds?: number;
}
