import { BackgroundEntry } from './background-entry';
import { Logger } from '@bitblit/ratchet/dist/common';
import { BackgroundConfig } from './background-config';
import { BackgroundConfigUtil } from './background-config-util';
import { ErrorRatchet } from '@bitblit/ratchet/dist/common/error-ratchet';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import { BackgroundProcessor } from './background-processor';
import { ModelValidator } from '../global/model-validator';

/**
 * This interface defines the things the background queue manager can do
 */
export class BackgroundEntryValidator {
  constructor(private cfg: BackgroundConfig, private modelValidator: ModelValidator) {}

  public validTypes(): string[] {
    const rval: string[] = BackgroundConfigUtil.processNames(this.cfg);
    return rval;
  }

  public validType(type: string): boolean {
    return this.validTypes().includes(type);
  }

  public createEntry(type: string, data: any = {}, metadata: any = {}, returnNullOnInvalid: boolean = false): BackgroundEntry {
    if (!this.validType(type)) {
      Logger.warn('Tried to create invalid type : %s (Valid are %j)', type, this.validTypes);
      return null;
    }

    let rval: BackgroundEntry = {
      created: new Date().getTime(),
      type: type,
      data: data,
      metadata: metadata,
    };

    const errors: string[] = this.validateEntry(rval);
    if (errors.length > 0) {
      if (returnNullOnInvalid) {
        Logger.warn('Supplied entry data was invalid, returning null');
        rval = null;
      } else {
        ErrorRatchet.throwFormattedErr('Cannot create entry %j : errors : %j', rval, errors);
      }
    }

    return rval;
  }

  public validateEntry(entry: BackgroundEntry): string[] {
    let rval: string[] = [];
    if (!entry) {
      rval.push('Entry is null');
    } else if (!StringRatchet.trimToNull(entry.type)) {
      rval.push('Entry type is null or empty');
    } else if (!this.validType(entry.type)) {
      rval.push('Entry type is invalid');
    } else {
      const proc: BackgroundProcessor<any, any> = this.cfg.processors.find((s) => s.typeName === entry.type);
      if (proc.validateData) {
        rval = rval.concat(proc.validateData(entry.data) || []);
      } else if (proc.dataSchema) {
        rval = rval.concat(this.modelValidator.validate(proc.dataSchema, entry.data) || []);
      }
      if (proc.validateMetaData) {
        rval = rval.concat(proc.validateMetaData(entry.metadata) || []);
      } else if (proc.metaDataSchema) {
        rval = rval.concat(this.modelValidator.validate(proc.metaDataSchema, entry.metadata) || []);
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
}
