import { RouteValidatorConfig } from './route-validator-config';
import { HandlerFunction } from '../../config/http/handler-function';

export interface RouteMapping {
  method: string;
  path: string;
  function: HandlerFunction<any>;

  // If set, then epsilon will auto-timeout with a 504
  // Mostly useful for when you want variable timeouts (APIGateway/Lambda only set one)
  timeoutMS: number;

  // If this is set, and fails, then it will 400
  validation: RouteValidatorConfig;

  // If this is set, and fails, then it will 500
  outboundValidation: RouteValidatorConfig;

  // If this is set, then :
  // If there is no token / bad token in the request, this will 401
  // If there is a required role that isnt found it will 403
  authorizerName: string;

  disableAutomaticBodyParse: boolean;
  disableQueryMapAssure: boolean;
  disableHeaderMapAssure: boolean;
  disablePathMapAssure: boolean;

  disableConvertNullReturnedObjectsTo404: boolean;
  allowLiteralStringNullAsPathParameter: boolean;
  allowLiteralStringNullAsQueryStringParameter: boolean;
  enableValidateOutboundResponseBody: boolean;
}
