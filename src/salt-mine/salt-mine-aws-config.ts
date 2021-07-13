import AWS from 'aws-sdk';

export interface SaltMineAwsConfig {
  queueUrl: string;
  notificationArn: string;
  sqs: AWS.SQS;
  sns: AWS.SNS;
}
