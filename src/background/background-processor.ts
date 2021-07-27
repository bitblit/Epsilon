import { BackgroundManager } from './background-manager';

export interface BackgroundProcessor<T> {
  typeName: string; // The name for this processor
  dataSchema?: string; // If set, the data object will be validated against this schema from the OpenAPI doc

  validateData?(input: T): string[];

  // Returns void since you can't use the result anyway
  handleEvent(data: T, mgr: BackgroundManager): Promise<void>;
}
