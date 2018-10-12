import {RouteValidatorConfig} from './route-validator-config';
import {RouteAuthorizationConfig} from './route-authorization-config';

export interface RouteMapping {
    method: string;
    path: string;
    handlerOb: any;
    handlerName: string; // Optional, if not set, 'handler' will be used

    requiredRoles: string[];

    // If this is set, and fails, then it will 400
    validation: RouteValidatorConfig;

    // If this is set, then :
    // If there is no token / bad token in the request, this will 401
    // If there is a required role that isnt found it will 403
    auth: RouteAuthorizationConfig; // Leave blank for unauthenticated

    disableAutomaticBodyParse: boolean;
    disableQueryMapAssure: boolean;
    disableHeaderMapAssure: boolean;
    disablePathMapAssure: boolean;

}
