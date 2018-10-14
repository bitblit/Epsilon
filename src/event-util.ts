import {APIGatewayEvent, APIGatewayEventRequestContext, AuthResponseContext} from 'aws-lambda';
import {UnauthorizedError} from './error/unauthorized-error';
import {CommonJwtToken} from '@bitblit/ratchet/dist/common/common-jwt-token';
import {RouterConfig} from './route/router-config';
import {Logger} from '@bitblit/ratchet/dist/common/logger';

/**
 * Endpoints about the api itself
 */
export class EventUtil {

    private constructor() {
    } // Prevent instantiation

    public static extractToken<T>(event: APIGatewayEvent): CommonJwtToken<T> {
        const auth: AuthResponseContext = EventUtil.extractAuthorizer(event);

        if (!auth) {
            throw new UnauthorizedError('Missing authorization context');
        } else {
            if (auth.userData) {
                return auth.userData;
            } else if (auth.userDataJSON) {
                return JSON.parse(auth.userDataJSON) as CommonJwtToken<T>;
            } else {
                throw new UnauthorizedError('Missing authorization context data');
            }
        }
    }

    public static extractTokenSrc(event: APIGatewayEvent): string {
        const auth = EventUtil.extractAuthorizer(event);
        return (auth) ? auth.srcData : null;
    }

    public static extractStage(event: APIGatewayEvent): string {
        let rc: APIGatewayEventRequestContext = EventUtil.extractRequestContext(event);
        return (rc) ? rc.stage : null;
    }

    public static extractRequestContext(event: APIGatewayEvent): APIGatewayEventRequestContext {
        return event.requestContext;
    }

    public static extractAuthorizer(event: APIGatewayEvent): AuthResponseContext {
        let rc: APIGatewayEventRequestContext = EventUtil.extractRequestContext(event);
        return (rc) ? rc.authorizer : null;
    }


    public static ipAddressChain(event: APIGatewayEvent): string[] {
        const headerVal: string = (event && event.headers) ? event.headers['X-Forwarded-For'] : null;
        let headerList: string[] = (headerVal) ? String(headerVal).split(',') : [];
        headerList = headerList.map(s => s.trim());
        return headerList;
    }

    public static ipAddress(event: APIGatewayEvent): string {
        const list: string[] = EventUtil.ipAddressChain(event);
        return (list && list.length > 0) ? list[0] : null;
    }

    public static bodyObject(event: APIGatewayEvent): any {
        let rval: any = null;
        if (event.body) {
            let contentType = event.headers['content-type'] || event.headers['Content-Type'] || 'application/octet-stream';
            rval = event.body;

            if (event.isBase64Encoded) {
                rval = Buffer.from(rval, 'base64');
            }
            if (contentType === 'application/json') {
                rval = JSON.parse(rval.toString('ascii'));
            }
        }
        return rval;
    }

    public static calcLogLevelViaEventOrEnvParam(curLevel: string, event: APIGatewayEvent, rConfig: RouterConfig): string {
        let rval: string = curLevel;
        if (rConfig && rConfig.envParamLogLevelName && process.env[rConfig.envParamLogLevelName]) {
            rval = process.env[rConfig.envParamLogLevelName];
            Logger.silly('Found env log level : %s', rval);
        }
        if (rConfig && rConfig.queryParamLogLevelName && event && event.queryStringParameters &&
            event.queryStringParameters[rConfig.queryParamLogLevelName]) {
            rval = event.queryStringParameters[rConfig.queryParamLogLevelName];
            Logger.silly('Found query log level : %s', rval);
        }
        return rval;
    }
}





