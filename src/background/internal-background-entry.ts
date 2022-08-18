import { BackgroundEntry } from './background-entry';

export interface InternalBackgroundEntry<T> extends BackgroundEntry<T> {
  guid: string;
  createdEpochMS: number;
  traceId: string;
  traceDepth: number;
}
