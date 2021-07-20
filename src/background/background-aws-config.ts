import AWS from 'aws-sdk';

export interface BackgroundAwsConfig {
  queueUrl: string;
  notificationArn: string;
  sqs: AWS.SQS;
  sns: AWS.SNS;
}
