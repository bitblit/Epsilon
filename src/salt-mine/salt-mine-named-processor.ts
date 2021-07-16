import { SaltMineConfig } from './salt-mine-config';

export interface SaltMineNamedProcessor<T, R> {
  typeName: string; // The name for this processor
  dataSchema?: string; // If set, the data object will be validated against this schema from the OpenAPI doc
  metaDataSchema?: string; // If set, the metadata object will be validated against this schema from the OpenAPI doc
  validateData?(input: T): Promise<string[]>; // If defined, validates the incoming data object with this instead of the OpenAPI doc
  validateMetaData?(input: R): Promise<string[]>; // If defined, validates the incoming metadata object with this instead of the OpenAPI doc

  // Returns void since you can't use the result anyway
  handleEvent(data: T, metaData: R, cfg: SaltMineConfig): Promise<void>;
}
