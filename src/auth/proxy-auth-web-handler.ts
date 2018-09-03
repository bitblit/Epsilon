import {RouterConfig} from '../route/router-config';
import {APIGatewayEvent, APIGatewayEventRequestContext, Callback, Context, ProxyResult} from 'aws-lambda';
import {Logger} from '@bitblit/ratchet/dist/common/logger';
import {WebHandler} from '../web-handler';
import {EpsilonJwtToken} from './epsilon-jwt-token';
import {AuthHandler} from './auth-handler';
import {WebTokenManipulator} from './web-token-manipulator';
import {EventUtil} from '../event-util';
import {UnauthorizedError} from '../error/unauthorized-error';
import {ForbiddenError} from '../error/forbidden-error';

/**
 * Basically the same as WebHandler, but implements Authentication in the Lambda
 * - This is here so that it is possible to use the PROXY handler (which precludes using API gateway authentication) as
 * if it was there
 */
export class ProxyAuthWebHandler {
    private wrapped: WebHandler;
    private webTokenManipulator: WebTokenManipulator;

    constructor(routing: RouterConfig, encryptionKey: string, issuer: string)
    {
        this.wrapped = new WebHandler(routing);
        this.webTokenManipulator = new WebTokenManipulator(encryptionKey, issuer);
    }

    public lambdaHandler (event: APIGatewayEvent, context: Context, callback: Callback) : void {
        try {
            if (!this.wrapped)
            {
                throw new Error('Router config not found');
            }

            const header: string = (event && event.headers) ? event.headers['Authorization'] : null;
            const token: string = (header && header.startsWith(AuthHandler.AUTH_HEADER_PREFIX)) ? header.substring(7) : null; // Strip "Bearer "
            const parsed:EpsilonJwtToken<any> = this.webTokenManipulator.parseAndValidateJWTString(token);

            if (parsed) {
                event.requestContext.authorizer = {
                    userJSON: JSON.stringify(parsed)
                }
            }

            this.wrapped.lambdaHandler(event, context, callback);
        }
        catch (err)
        {
            Logger.warn('Unhandled error (in wrapping catch) : %s \nStack was: %s\nEvt was: %j',err.message, err.stack, event);
            callback(null,this.wrapped.addCors(WebHandler.errorToProxyResult(err)));
        }
    };

    public static checkAuthorization(event: APIGatewayEvent, requiredRoles: string[] = []):void {
        const token:EpsilonJwtToken<any> = EventUtil.extractToken(event);
        if (!token) {
            throw new UnauthorizedError('Unauthorized');
        }

        requiredRoles.forEach(r => {
            if (!token.roles || token.roles.indexOf(r) == -1) {
                throw new ForbiddenError('Missing role ' + r);
            }
        })

    }

}
