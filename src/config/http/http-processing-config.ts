import { NullReturnedObjectHandling } from './null-returned-object-handling';
import { FilterFunction } from './filter-function';

export interface HttpProcessingConfig {
  // If set, used in logging to help debugging
  configName?: string;
  // If set, matching routes will timeout after this amount of time (with a 50x error)
  timeoutMS: number;
  // Mainly here so that I can define authorizers that aren't viewable in the public doc
  overrideAuthorizerName?: string;
  // Filters that run before the handler function (eg validation, authorization, authentication)
  preFilters?: FilterFunction[];
  // Filters that run after the handler function runs successfully (eg, compression, CORS)
  postFilters?: FilterFunction[];
  // Filters that run in case an error is thrown (eg, making 500's safe for public consumption, adding CORS headers)
  errorFilters?: FilterFunction[];
  // CAW: Defines what should be done if a handler function returns null
  // Handler functions should NOT return null - API Gateway/ALB won't accept it.  But sometimes they do, so
  // Epsilon can cleanup here.  The reason I have this in here, and not as a filter, is because a single piece
  // of code (run-handler-as-filter) both runs the handler, and converts its result into a proxy object, which
  // I don't want to break apart, but this has to happen between those 2 steps.
  nullReturnedObjectHandling?: NullReturnedObjectHandling;
}
