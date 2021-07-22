import AWS from 'aws-sdk';

export interface BackgroundAwsConfig {
  queueUrl: string;
  notificationArn: string;
  sendNotificationOnBackgroundError?: boolean;
  sendNotificationOnBackgroundValidationFailure?: boolean;
  // If either of the above are set to true, notifications will be sent here
  backgroundProcessFailureSnsArn?: string;
  sqs: AWS.SQS;
  sns: AWS.SNS;
}
