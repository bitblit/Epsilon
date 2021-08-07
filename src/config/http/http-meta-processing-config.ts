import { NullReturnedObjectHandling } from './null-returned-object-handling';

export interface HttpMetaProcessingConfig {
  // If set, used in logging to help debugging
  configName?: string;
  // If set, matching routes will timeout after this amount of time (with a 50x error)
  timeoutMS: number;
  // If set, matching routes will use this instead of the one spec'd in the open api doc
  overrideAuthorizerName?: string;
  // If set, these headers will always be added to outbound traffic
  customExtraHeaders?: Record<string, string>; // TODO: Implement
  // If set, this error message will be sent on 50x errors
  defaultErrorMessage?: string;
  // If set, this will be the value of the Access-Control-Allow-Origin header
  corsAllowedOrigins?: string;
  // If set, this will be the value of the Access-Control-Allow-Methods header
  corsAllowedMethods?: string;
  // If set, this will be the value of the Access-Control-Allow-Headers header
  corsAllowedHeaders?: string;
  // If set, query params will not be URIDecoded before passing to the handler
  disableAutoFixStillEncodedQueryParams?: boolean;
  // If set, no CORS headers will be added to responses
  disableAutoAddCorsHeadersToResponses?: boolean;
  // If set, the response will not be auto-gzipped (and headers added)
  disableCompression?: boolean;
  // If set, inbound objects (Request bodies) will not be validated
  disableValidateInboundRequestBody?: boolean;
  // If set, inbound query string parameters will not be validated
  disableValidateInboundQueryParameters?: boolean; // TODO: Implement
  // If set, outbound objects will also be validated
  enableValidateOutboundResponseBody?: boolean;
  // If set, the body won't be parsed by epsilon (uncommon)
  disableAutomaticBodyParse?: boolean;
  // If set, epsilon won't guarantee that the query/path/header maps are non-null (uncommon)
  disableParameterMapAssure?: boolean;
  // If set, epsilon won't automatically
  nullReturnedObjectHandling?: NullReturnedObjectHandling;
  // If set, epsilon won't throw a 400 when the word 'null' is supplied as a path parameter
  allowLiteralStringNullAsPathParameter?: boolean;
  // If set, epsilon won't throw a 400 when the word 'null' is supplied as a query string parameter
  allowLiteralStringNullAsQueryStringParameter?: boolean;
}
