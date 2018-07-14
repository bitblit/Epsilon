import {RouteMapping} from './route-mapping';

export interface RouterConfig {
    routes: RouteMapping[];

    // Future expansion
    disableCORS: boolean;
    disableCompression: boolean;
    staticContentPaths: string[];
}
