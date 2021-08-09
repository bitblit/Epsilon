import { NullReturnedObjectHandling } from './null-returned-object-handling';
import { FilterFunction } from './filter-function';

export interface HttpMetaProcessingConfig {
  // If set, used in logging to help debugging
  configName?: string;
  // If set, matching routes will timeout after this amount of time (with a 50x error)
  timeoutMS: number;
  overrideAuthorizerName?: string; // Mainly here so that I can define authorizers that aren't viewable in the public doc
  preFilters?: FilterFunction[];
  postFilters?: FilterFunction[];
  errorFilters?: FilterFunction[];
  // If set, epsilon won't automatically
  nullReturnedObjectHandling?: NullReturnedObjectHandling;
}
