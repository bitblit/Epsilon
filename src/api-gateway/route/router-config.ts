import {RouteMapping} from './route-mapping';
import {ModelValidator} from './model-validator';
import {AuthorizerFunction} from './authorizer-function';
import {WebTokenManipulator} from '../auth/web-token-manipulator';
import {ErrorProcessorFunction} from './error-processor-function';

export interface RouterConfig {
    routes: RouteMapping[];

    authorizers: Map<string, AuthorizerFunction>;

    // Future expansion
    disableCORS: boolean;
    disableCompression: boolean;
    staticContentPaths: string[];

    defaultTimeoutMS: number;

    errorProcessor: ErrorProcessorFunction;

    // If you set a web token manipulator, epsilon will auto-parse the Authorization header
    webTokenManipulator: WebTokenManipulator;

    modelValidator: ModelValidator; // Must be set to use model validation in your route mappings

    // Should typically be your stage name, but can be different in weird cases like custom name map
    // These will be matched case insensitive
    prefixesToStripBeforeRouteMatch: string[];

}
