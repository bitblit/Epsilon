import { ErrorRatchet, Logger, StringRatchet } from '@bitblit/ratchet/common';
import { BackgroundConfig } from '../config/background/background-config';
import { BackgroundEntry } from './background-entry';
import { BackgroundProcessor } from '../config/background/background-processor';
import { BackgroundAwsConfig } from '../config/background/background-aws-config';
import { ModelValidator } from '@bitblit/ratchet/model-validator';

/**
 * Handles all submission of work to the background processing system.
 */
export class BackgroundValidator {
  constructor(
    private cfg: BackgroundConfig,
    private modelValidator: ModelValidator,
  ) {}

  public findProcessor(typeName: string): BackgroundProcessor<any> {
    const rval: BackgroundProcessor<any> = this.cfg.processors.find((s) => s.typeName === typeName);
    return rval;
  }

  public validType(type: string): boolean {
    return !!this.findProcessor(type);
  }

  public validateEntry<T>(entry: BackgroundEntry<T>): string[] {
    const rval: string[] = [];
    if (!entry) {
      rval.push('Entry is null');
    } else if (!StringRatchet.trimToNull(entry.type)) {
      rval.push('Entry type is null or empty');
      const proc: BackgroundProcessor<any> = this.findProcessor(entry.type);

      if (!proc) {
        rval.push('Entry type is invalid');
      }
    }
    return rval;
  }

  public validateEntryAndThrowException<T>(entry: BackgroundEntry<T>): void {
    const errors: string[] = this.validateEntry(entry);
    if (errors.length > 0) {
      Logger.warn('Invalid entry %j : errors : %j', entry, errors);
      ErrorRatchet.throwFormattedErr('Invalid entry %j : errors : %j', entry, errors);
    }
  }

  public static validateAndMapProcessors(
    processorInput: BackgroundProcessor<any>[],
    modelValidator: ModelValidator,
  ): Map<string, BackgroundProcessor<any>> {
    const rval: Map<string, BackgroundProcessor<any>> = new Map<string, BackgroundProcessor<any>>();
    processorInput.forEach((p, idx) => {
      if (!p) {
        ErrorRatchet.throwFormattedErr('Null processor provided at index %d', idx);
      }
      if (!StringRatchet.trimToNull(p.typeName)) {
        ErrorRatchet.throwFormattedErr('Processor at index %d defines no name', idx);
      }

      if (rval.has(p.typeName)) {
        ErrorRatchet.throwFormattedErr('More than one processor defined for type %s', p.typeName);
      }

      rval.set(p.typeName, p);
    });
    return rval;
  }

  public static validateAwsConfig(cfg: BackgroundAwsConfig): string[] {
    const rval: string[] = [];
    if (!cfg) {
      rval.push('Null config');
    } else {
      if (!cfg.notificationArn) {
        rval.push('AWS config missing notificationArn');
      }
      if (!cfg.queueUrl) {
        rval.push('AWS config missing queueUrl');
      }
      if (
        (cfg.sendNotificationOnBackgroundError || cfg.sendNotificationOnBackgroundValidationFailure) &&
        !cfg.backgroundProcessFailureSnsArn
      ) {
        rval.push('At least one send notification flag set to true but no sns arn set');
      }
      if (cfg.sendLargePayloadsToS3 && !(cfg.s3Bucket && cfg.s3BucketPath)) {
        rval.push('If sendLargePayloadsToS3, then both s3Bucket and s3BucketPath must be defined');
      }
    }
    return rval;
  }

  public static validateConfig(cfg: BackgroundConfig): string[] {
    const rval: string[] = [];
    if (!cfg) {
      rval.push('Null config');
    } else {
      if (!cfg.processors || cfg.processors.length === 0) {
        rval.push('No processes specified');
      }
    }
    return rval;
  }
}
