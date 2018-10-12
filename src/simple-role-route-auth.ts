import {APIGatewayEvent} from 'aws-lambda';
import {Logger} from '@bitblit/ratchet/dist/common/logger';
import {CommonJwtToken} from '@bitblit/ratchet/dist/common/common-jwt-token';
import {RouteMapping} from './route/route-mapping';

export class SimpleRoleRouteAuth {

    constructor(private requiredRoleOneOf: string[], private requiredRoleAllOf: string[]) {
    }

    public async handler(token: CommonJwtToken<any>, event: APIGatewayEvent, route: RouteMapping): Promise<boolean> {
        let rval: boolean = true;
        if (this.requiredRoleOneOf) {
            this.requiredRoleOneOf.forEach( r => {
                rval = rval || (token.roles.indexOf(r)>-1);
            });
            if (!rval) {
                Logger.warn('Request to %s failed to find at least one of %j', route.path, this.requiredRoleOneOf);
            }
        }
        if (rval && this.requiredRoleAllOf) {
            this.requiredRoleAllOf.forEach( r => {
                rval = rval && (token.roles.indexOf(r)>-1);
            });
            if (!rval) {
                Logger.warn('Request to %s failed to find all of %j', route.path, this.requiredRoleAllOf);
            }
        }
        return rval;
    }

}
