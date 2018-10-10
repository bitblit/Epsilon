import {RouteMapping} from './route-mapping';
import {ModelValidator} from './model-validator';

export interface RouterConfig {
    routes: RouteMapping[];

    // Future expansion
    disableCORS: boolean;
    disableCompression: boolean;
    staticContentPaths: string[];
    // If set, this means the stage does not match what is in the event (due to mapping at the custom name level)
    customStageValue: string;
    enableAuthorizationHeaderParsing: boolean;

    authorizationHeaderEncryptionKey: string; // You must set this if you will use epsilon auth
    modelValidator: ModelValidator; // Must be set to use model validation in your route mappings

}
