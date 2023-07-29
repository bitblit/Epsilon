import { BackgroundTransactionLogger } from '../config/background/background-transaction-logger';
import { BackgroundTransactionLog } from '../config/background/background-transaction-log';
import { AbstractBackgroundManager } from './manager/abstract-background-manager';
import { ErrorRatchet } from '@bitblit/ratchet/common';
import { Logger } from '@bitblit/ratchet/common';
import { S3Client } from '@aws-sdk/client-s3';
import { S3CacheRatchet } from '@bitblit/ratchet/aws';

export class S3BackgroundTransactionLogger implements BackgroundTransactionLogger {
  private s3TransactionLogCacheRatchet: S3CacheRatchet;

  constructor(private cfg: BackgroundS3TransactionLoggingConfig) {
    const err: string[] = S3BackgroundTransactionLogger.validateConfig(cfg);
    if (err.length) {
      ErrorRatchet.throwFormattedErr('Invalid S3BackgroundTransactionLogger config : %j', err);
    }
    this.s3TransactionLogCacheRatchet = new S3CacheRatchet(this.cfg.s3, this.cfg.bucket);
  }

  public async logTransaction(txLog: BackgroundTransactionLog): Promise<void> {
    if (txLog) {
      if (txLog.request?.guid) {
        await this.s3TransactionLogCacheRatchet.writeObjectToCacheFile(
          AbstractBackgroundManager.backgroundGuidToPath(this.cfg.prefix, txLog.request.guid),
          txLog,
        );
      } else {
        Logger.warn('Could not write transaction record - no guid defined : %j', txLog);
      }
    } else {
      Logger.silly('Skipping write of null log');
    }
  }

  public async readTransactionLog(txGuid: string): Promise<BackgroundTransactionLog> {
    const path: string = AbstractBackgroundManager.backgroundGuidToPath(this.cfg.prefix, txGuid);
    const log = await this.s3TransactionLogCacheRatchet.fetchCacheFileAsObject<BackgroundTransactionLog>(path);
    return log;
  }

  public static validateConfig(cfg: BackgroundS3TransactionLoggingConfig): string[] {
    const rval: string[] = [];
    if (cfg) {
      if (!cfg.s3) {
        rval.push('You must supply an S3 object');
      }
      if (!cfg.bucket) {
        rval.push('You must supply a bucket');
      }
      if (!cfg.timeToLiveDays) {
        rval.push('You must supply a timeToLiveDays');
      }
    } else {
      rval.push('No config defined');
    }
    return rval;
  }
}

export interface BackgroundS3TransactionLoggingConfig {
  s3: S3Client;
  bucket: string;
  timeToLiveDays: number;
  prefix?: string;
}
