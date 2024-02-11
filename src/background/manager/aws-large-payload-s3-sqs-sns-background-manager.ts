import { ErrorRatchet, Logger, StringRatchet } from '@bitblit/ratchet/common';
import { SQSClient } from '@aws-sdk/client-sqs';
import { BackgroundEntry } from '../background-entry';
import { BackgroundAwsConfig } from '../../config/background/background-aws-config';
import { InternalBackgroundEntry } from '../internal-background-entry';
import { SNSClient } from '@aws-sdk/client-sns';
import { AwsSqsSnsBackgroundManager } from './aws-sqs-sns-background-manager';
import { S3CacheRatchetLike } from '@bitblit/ratchet/aws';

/**
 * Handles all submission of work to the background processing system.
 *
 * Note that this does NOT validate the input, it just passes it along.  This is
 * because it creates a circular reference to the processors if we try since they
 * define the type and validation.
 */
export class AwsLargePayloadS3SqsSnsBackgroundManager extends AwsSqsSnsBackgroundManager {
  // SQS and SNS payload limit is (256 * 1024). Set threshold lower to allow extra metadata
  private static readonly LARGE_MESSAGE_SIZE_THRESHOLD: number = 250_000;
  private static readonly LARGE_MESSAGE_S3_PATH_META_KEY: string = 'S3_STORAGE_KEY';

  constructor(
    _awsConfig: BackgroundAwsConfig,
    _sqs: SQSClient,
    _sns: SNSClient,
    private _s3: S3CacheRatchetLike,
    private pathPrefix: string = '',
  ) {
    super(_awsConfig, _sqs, _sns);
    if (!_s3) {
      ErrorRatchet.throwFormattedErr('Cannot start - no s3Client provided');
    }
    if (!StringRatchet.trimToNull(_s3.getDefaultBucket())) {
      ErrorRatchet.throwFormattedErr('Cannot start - no default bucket provided');
    }
    if (!pathPrefix && pathPrefix.endsWith('/')) {
      ErrorRatchet.throwFormattedErr('Path prefix may not end with /');
    }
  }

  public get backgroundManagerName(): string {
    return 'AwsLargePayloadS3SqsSnsBackgroundManager';
  }

  public get s3(): S3CacheRatchetLike {
    return this._s3;
  }

  public async wrapEntryForInternal<T>(
    entry: BackgroundEntry<T>,
    overrideTraceId?: string,
    overrideTraceDepth?: number,
  ): Promise<InternalBackgroundEntry<T>> {
    const rval: InternalBackgroundEntry<T> = await super.wrapEntryForInternal(entry, overrideTraceId, overrideTraceDepth);

    const payloadApproximateSize: number = Buffer.byteLength(JSON.stringify(rval), 'utf-8');
    if (payloadApproximateSize > AwsLargePayloadS3SqsSnsBackgroundManager.LARGE_MESSAGE_SIZE_THRESHOLD) {
      Logger.info('Message payload is above LARGE_MESSAGE_SIZE_THRESHOLD. Uploading to s3.');
      rval.meta = rval.meta || {};
      const pathToData: string = await this.writeMessageToS3(rval.guid, rval.data);
      rval.meta[AwsLargePayloadS3SqsSnsBackgroundManager.LARGE_MESSAGE_S3_PATH_META_KEY] = pathToData;
      rval.data = undefined;
    }

    return rval;
  }

  private async writeMessageToS3(guid: string, entry: unknown): Promise<string> {
    let s3FilePath: string = StringRatchet.trimToNull(this.pathPrefix) ? this.pathPrefix + '/' : '';
    s3FilePath += guid + '.json';
    await this.s3.writeObjectToCacheFile(s3FilePath, entry);
    return s3FilePath;
  }

  public async modify<T>(entry: InternalBackgroundEntry<T>): Promise<InternalBackgroundEntry<T>> {
    if (entry?.meta?.[AwsLargePayloadS3SqsSnsBackgroundManager.LARGE_MESSAGE_S3_PATH_META_KEY]) {
      Logger.silly('Restoring large data from %s', entry.meta[AwsLargePayloadS3SqsSnsBackgroundManager.LARGE_MESSAGE_S3_PATH_META_KEY]);
      const parsed: T = await this._s3.fetchCacheFileAsObject<T>(
        entry.meta[AwsLargePayloadS3SqsSnsBackgroundManager.LARGE_MESSAGE_S3_PATH_META_KEY],
      );
      entry.data = parsed;
      delete entry.meta[AwsLargePayloadS3SqsSnsBackgroundManager.LARGE_MESSAGE_S3_PATH_META_KEY];
    }
    return entry;
  }
}
