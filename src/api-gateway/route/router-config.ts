import {RouteMapping} from './route-mapping';
import {ModelValidator} from './model-validator';
import {AuthorizerFunction} from './authorizer-function';

export interface RouterConfig {
    routes: RouteMapping[];

    authorizers: Map<string, AuthorizerFunction>;

    // Future expansion
    disableCORS: boolean;
    disableCompression: boolean;
    staticContentPaths: string[];

    // If you set the auth header encryption key, epsilon will auto-parse the Authorization header
    authorizationHeaderEncryptionKey: string;
    modelValidator: ModelValidator; // Must be set to use model validation in your route mappings

    // Should typically be your stage name, but can be different in weird cases like custom name map
    // These will be matched case insensitive
    prefixesToStripBeforeRouteMatch: string[];

    envParamLogLevelName: string;
    queryParamLogLevelName: string;
}
