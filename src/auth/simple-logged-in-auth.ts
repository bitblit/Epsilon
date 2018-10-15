import {APIGatewayEvent} from 'aws-lambda';
import {Logger} from '@bitblit/ratchet/dist/common/logger';
import {CommonJwtToken} from '@bitblit/ratchet/dist/common/common-jwt-token';
import {RouteMapping} from '../route/route-mapping';

export class SimpleLoggedInAuth {

    constructor() {
    }

    public async handler(token: CommonJwtToken<any>, event: APIGatewayEvent, route: RouteMapping): Promise<boolean> {
        // Just verifies that there is a valid token in the request
        const rval: boolean = !!token;
        Logger.silly('SimpleLoggedInAuth returning %s for %s', rval, event.path);
        return rval;
    }

}
