import { BackgroundEntryMetadata } from './background-entry-metadata';

export interface BackgroundEntry<T> {
  type: string;
  data: T;
  meta?: BackgroundEntryMetadata;
}
