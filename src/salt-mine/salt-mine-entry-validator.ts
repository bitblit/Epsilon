import { SaltMineEntry } from './salt-mine-entry';
import { Logger } from '@bitblit/ratchet/dist/common';
import { SaltMineConfig } from './salt-mine-config';
import { SaltMineConfigUtil } from './salt-mine-config-util';
import { ErrorRatchet } from '@bitblit/ratchet/dist/common/error-ratchet';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import { SaltMineNamedProcessor } from './salt-mine-named-processor';
import { ModelValidator } from '../http/route/model-validator';

/**
 * This interface defines the things the salt mine queue manager can do
 */
export class SaltMineEntryValidator {
  constructor(private cfg: SaltMineConfig, private modelValidator: ModelValidator) {}

  public validTypes(): string[] {
    return SaltMineConfigUtil.processNames(this.cfg);
  }

  public validType(type: string): boolean {
    return this.validTypes().includes(type);
  }

  public createEntry(type: string, data: any = {}, metadata: any = {}, returnNullOnInvalid: boolean = false): SaltMineEntry {
    if (!this.validType(type)) {
      Logger.warn('Tried to create invalid type : %s (Valid are %j)', type, this.validTypes);
      return null;
    }

    let rval: SaltMineEntry = {
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

  public validateEntry(entry: SaltMineEntry): string[] {
    let rval: string[] = [];
    if (!entry) {
      rval.push('Entry is null');
    } else if (!StringRatchet.trimToNull(entry.type)) {
      rval.push('Entry type is null or empty');
    } else if (!this.validType(entry.type)) {
      rval.push('Entry type is invalid');
    } else {
      const proc: SaltMineNamedProcessor<any, any> = this.cfg.processors.find((s) => s.typeName === entry.type);
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

  public validateEntryAndThrowException(entry: SaltMineEntry): void {
    const errors: string[] = this.validateEntry(entry);
    if (errors.length > 0) {
      Logger.warn('Invalid entry %j : errors : %j', entry, errors);
      ErrorRatchet.throwFormattedErr('Invalid entry %j : errors : %j', entry, errors);
    }
  }
}
