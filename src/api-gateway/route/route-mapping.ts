import {RouteValidatorConfig} from './route-validator-config';
import {HandlerFunction} from './handler-function';

export interface RouteMapping {
    method: string;
    path: string;
    function: HandlerFunction<any>,

    // If this is set, and fails, then it will 400
    validation: RouteValidatorConfig;

    // If this is set, then :
    // If there is no token / bad token in the request, this will 401
    // If there is a required role that isnt found it will 403
    authorizerName: string;

    disableAutomaticBodyParse: boolean;
    disableQueryMapAssure: boolean;
    disableHeaderMapAssure: boolean;
    disablePathMapAssure: boolean;
}