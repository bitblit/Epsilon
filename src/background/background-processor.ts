import { BackgroundConfig } from './background-config';

export interface BackgroundProcessor<T, R> {
  typeName: string; // The name for this processor
  dataSchema?: string; // If set, the data object will be validated against this schema from the OpenAPI doc
  metaDataSchema?: string; // If set, the metadata object will be validated against this schema from the OpenAPI doc

  validateData?(input: T): string[];
  validateMetaData?(input: R): string[];

  // Returns void since you can't use the result anyway
  handleEvent(data: T, metaData: R, cfg: BackgroundConfig): Promise<void>;
}
