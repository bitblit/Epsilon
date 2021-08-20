export interface BackgroundS3TransactionLoggingConfig {
  s3: AWS.S3;
  bucket: string;
  timeToLiveDays: number;
  prefix?: string;
}
