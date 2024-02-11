export interface BackgroundAwsConfig {
  queueUrl: string;
  notificationArn: string;
  sendNotificationOnBackgroundError?: boolean;
  sendNotificationOnBackgroundValidationFailure?: boolean;
  // If either of the above are set to true, notifications will be sent here
  backgroundProcessFailureSnsArn?: string;

  sendLargePayloadsToS3?: boolean;
  s3Bucket?: string;
  s3BucketPath?: string;
}
