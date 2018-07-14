import {Logger} from '@bitblit/ratchet/dist/common/logger';
import {APIGatewayEvent, APIGatewayEventRequestContext, AuthResponseContext} from 'aws-lambda';
import {EpsilonJwtToken} from './auth/epsilon-jwt-token';

/**
 * Endpoints about the api itself
 */
export class EventUtil {

    public static extractToken<T>(event: APIGatewayEvent): EpsilonJwtToken<T> {
        const auth:AuthResponseContext = EventUtil.extractAuthorizer(event);

        if (!auth || !auth.userJSON) {
            throw new Error('Missing authorization context');
        } else {
            const userJSON = auth.userJSON;
            const usr = JSON.parse(userJSON) as EpsilonJwtToken<T>;
            return usr;
        }
    }

    public static extractTokenSrc(event: APIGatewayEvent): string {
        const auth = EventUtil.extractAuthorizer(event);
        return (auth) ? auth.srcData : null;
    }

    public static extractStage(event: APIGatewayEvent) : string {
        let rc:APIGatewayEventRequestContext =  EventUtil.extractRequestContext(event);
        return (rc)?rc.stage:null;
    }

    public static extractRequestContext(event: APIGatewayEvent) : APIGatewayEventRequestContext {
        return event.requestContext;
    }

    public static extractAuthorizer(event: APIGatewayEvent) : AuthResponseContext {
        let rc:APIGatewayEventRequestContext =  EventUtil.extractRequestContext(event);
        return (rc)?rc.authorizer:null;
    }
}
