import { ModelValidator } from '@bitblit/ratchet/dist/model-validator';
import { Logger } from '@bitblit/ratchet/dist/common';
import { ErrorRatchet } from '@bitblit/ratchet/dist/common/error-ratchet';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import { BackgroundConfig } from '../config/background/background-config';
import { BackgroundProcessor } from '../config/background-processor';
import { BackgroundEntry } from './background-entry';

/**
 * Handles all submission of work to the background processing system.
 */
export class BackgroundValidator {
  constructor(private cfg: BackgroundConfig, private modelValidator: ModelValidator) {}

  public findProcessor(typeName: string): BackgroundProcessor<any> {
    const rval: BackgroundProcessor<any> = this.cfg.processors.find((s) => s.typeName === typeName);
    return rval;
  }

  public validType(type: string): boolean {
    return !!this.findProcessor(type);
  }

  public validateEntry(entry: BackgroundEntry): string[] {
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

  public validateEntryAndThrowException(entry: BackgroundEntry): void {
    const errors: string[] = this.validateEntry(entry);
    if (errors.length > 0) {
      Logger.warn('Invalid entry %j : errors : %j', entry, errors);
      ErrorRatchet.throwFormattedErr('Invalid entry %j : errors : %j', entry, errors);
    }
  }

  public static validateAndMapProcessors(
    processorInput: BackgroundProcessor<any>[],
    modelValidator: ModelValidator
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

  public static validateConfig(cfg: BackgroundConfig): string[] {
    const rval: string[] = [];
    if (!cfg) {
      rval.push('Null config');
    } else {
      if (!cfg.processors || cfg.processors.length === 0) {
        rval.push('No processes specified');
      }
      if (!cfg.aws) {
        rval.push('AWS config not defined');
      } else {
        if (!cfg.aws.notificationArn) {
          rval.push('AWS config missing notificationArn');
        }
        if (!cfg.aws.queueUrl) {
          rval.push('AWS config missing queueUrl');
        }
        if (
          (cfg.aws.sendNotificationOnBackgroundError || cfg.aws.sendNotificationOnBackgroundValidationFailure) &&
          !cfg.aws.backgroundProcessFailureSnsArn
        ) {
          rval.push('At least one send notification flag set to true but no sns arn set');
        }
      }
    }
    return rval;
  }
}
