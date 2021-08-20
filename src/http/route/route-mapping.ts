import { RouteValidatorConfig } from './route-validator-config';
import { HandlerFunction } from '../../config/http/handler-function';
import { HttpProcessingConfig } from '../../config/http/http-processing-config';

export interface RouteMapping {
  method: string;
  path: string;
  function: HandlerFunction<any>;

  // This will always be set, either pointing at a specific one or the default one
  metaProcessingConfig: HttpProcessingConfig;
  // If this is set, and fails, then it will 400
  validation: RouteValidatorConfig;
  // If this is set, enabled, and fails, then it will 500
  outboundValidation: RouteValidatorConfig;

  // If this is set, then :
  // If there is no token / bad token in the request, this will 401
  // If there is a required role that isn't found it will 403
  authorizerName: string;
}
