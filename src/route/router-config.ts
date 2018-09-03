import {RouteMapping} from './route-mapping';

export interface RouterConfig {
    routes: RouteMapping[];

    // Future expansion
    disableCORS: boolean;
    disableCompression: boolean;
    staticContentPaths: string[];
    // If set, this means the stage does not match what is in the event (due to mapping at the custom name level)
    customStageValue: string;
}
