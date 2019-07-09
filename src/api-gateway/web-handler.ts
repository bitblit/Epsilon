import {RouterConfig} from './route/router-config';
import {APIGatewayEvent, ProxyResult} from 'aws-lambda';
import {Logger} from '@bitblit/ratchet/dist/common/logger';
import * as Route from 'route-parser';
import {UnauthorizedError} from './error/unauthorized-error';
import {ForbiddenError} from './error/forbidden-error';
import {CommonJwtToken} from '@bitblit/ratchet/dist/common/common-jwt-token';
import {RouteMapping} from './route/route-mapping';
import {MisconfiguredError} from './error/misconfigured-error';
import {BadRequestError} from './error/bad-request-error';
import {ResponseUtil} from './response-util';
import {ExtendedAPIGatewayEvent} from './route/extended-api-gateway-event';
import {EventUtil} from './event-util';
import {ExtendedAuthResponseContext} from './route/extended-auth-response-context';
import {AuthorizerFunction} from './route/authorizer-function';
import {MapRatchet} from '@bitblit/ratchet/dist/common/map-ratchet';
import {WebTokenManipulatorUtil} from './auth/web-token-manipulator-util';
import {PromiseRatchet} from '@bitblit/ratchet/dist/common/promise-ratchet';
import {TimeoutToken} from '@bitblit/ratchet/dist/common/timeout-token';
import {RequestTimeoutError} from './error/request-timeout-error';

/**
 * This class functions as the adapter from a default lamda function to the handlers exposed via Epsilon
 */
export class WebHandler {
    private corsAllowedHeaders: string = 'Authorization, Origin, X-Requested-With, Content-Type, Range';  // Since safari hates '*'

    constructor(private routerConfig: RouterConfig) {
    }

    public async lambdaHandler(event: APIGatewayEvent): Promise<ProxyResult> {
        try {
            if (!this.routerConfig) {
                throw new Error('Router config not found');
            }

            let handler: Promise<any> = this.findHandler(event);
            Logger.debug('Processing event : %j', event);
            const result: any = await handler;
            if (result instanceof TimeoutToken) {
                throw new RequestTimeoutError('Timed out');
            }
            Logger.debug('Initial return value : %j', result);
            let proxyResult: ProxyResult = ResponseUtil.coerceToProxyResult(result);
            const initSize: number = proxyResult.body.length;
            Logger.silly('Proxy result : %j', proxyResult);
            proxyResult = this.addCors(proxyResult);
            Logger.silly('CORS result : %j', proxyResult);
            if (!this.routerConfig.disableCompression) {
                const encodingHeader: string = (event && event.headers)?
                    MapRatchet.extractValueFromMapIgnoreCase(event.headers, 'accept-encoding') : null;
                proxyResult = await ResponseUtil.applyGzipIfPossible(encodingHeader, proxyResult);
            }
            Logger.setTracePrefix(null); // Just in case it was set
            Logger.debug('Pre-process: %d bytes, post: %d bytes', initSize, proxyResult.body.length);
            return proxyResult;
        } catch (err) {
            if (!err['statusCode']) { // If it has a status code field then I'm assuming it was sent on purpose
                try {
                    await this.routerConfig.errorProcessor(event, err, this.routerConfig);
                } catch (err) {
                    Logger.error('Really bad - your error processor has an error in it : %s',err,err);
                }
            }

            // Do this after the above code, since we want timeouts logged
            if (err.message==='Timeout') {
                err['statusCode'] = 504; // Set as a gateway timeout
            }

            const errProxy: ProxyResult = ResponseUtil.errorToProxyResult(err);
            const errWithCORS: ProxyResult = this.addCors(errProxy);
            Logger.setTracePrefix(null); // Just in case it was set
            return errWithCORS;
        }
    };

    // Public so it can be used in auth-web-handler
    public addCors(input: ProxyResult): ProxyResult {
        if (!this.routerConfig.disableCORS) {
            ResponseUtil.addCORSToProxyResult(input, this.corsAllowedHeaders);
        }
        return input;
    }

    public async findHandler(event: APIGatewayEvent, add404OnMissing: boolean = true): Promise<any> {
        let rval: Promise<any> = null;

        // See: https://www.npmjs.com/package/route-parser
        let cleanPath: string = this.cleanPath(event);

        // Filter routes to only matches
        const methodLower: string = event.httpMethod.toLowerCase();
        let matchRoutes: RouteAndParse[] = this.routerConfig.routes.map(r => {
            let rval: RouteAndParse = null;
            if (r.method && r.method.toLowerCase() === methodLower) {
                let routeParser: Route = new Route(r.path);
                let parsed: any = routeParser.match(cleanPath);
                if (parsed!==false) {
                    rval = {
                        mapping: r,
                        route: routeParser,
                        parsed: parsed
                    }
                }
            }
            return rval;
        }).filter(r => r!=null);
        // Pick the 'best' match
        matchRoutes.sort((a,b) => {return (Object.keys(a.parsed).length - Object.keys(b.parsed).length);});

        // Execute
        if (matchRoutes.length>0) {
            const rm: RouteAndParse = matchRoutes[0];

            // We extend with the parsed params here in case we are using the AWS any proxy
            event.pathParameters = Object.assign({}, event.pathParameters, rm.parsed);

            // Check authentication / authorization
            const passAuth: boolean = await this.applyAuth(event, rm.mapping);

            // Cannot get here without a valid auth/body, would've thrown an error
            const extEvent: ExtendedAPIGatewayEvent = this.extendApiGatewayEvent(event, rm.mapping);

            // Check validation
            const passBodyValid: boolean = await this.applyBodyObjectValidation(extEvent, rm.mapping);

            rval = PromiseRatchet.timeout(rm.mapping.function(extEvent), 'Timed out after '+rm.mapping.timeoutMS+' ms', rm.mapping.timeoutMS);

        }

        if (!rval && add404OnMissing) {
            Logger.debug('Failed to find handler for %s (cleaned path was %s, strip prefixes were %j)', event.path,
                cleanPath, this.routerConfig.prefixesToStripBeforeRouteMatch);
            rval = Promise.resolve(ResponseUtil.errorResponse(['No such endpoint'], 404));
        }
        return rval;

    }

    private cleanPath(event: APIGatewayEvent): string {
        let rval: string = event.path;
        // First, strip any leading /
        while (rval.startsWith('/')) {
            rval = rval.substring(1);
        }
        // If there are any listed prefixes, strip them
        if (this.routerConfig.prefixesToStripBeforeRouteMatch) {
            this.routerConfig.prefixesToStripBeforeRouteMatch.forEach(prefix => {
                if (rval.toLowerCase().startsWith(prefix.toLowerCase() + '/')) {
                    rval = rval.substring(prefix.length);
                }
            })
        }

        // Strip any more leading /
        while (rval.startsWith('/')) {
            rval = rval.substring(1);
        }
        // Finally, put back exactly 1 leading / to match what comes out of open api
        rval = '/' + rval;

        return rval;
    }

    private extendApiGatewayEvent(event: APIGatewayEvent, routeMap: RouteMapping): ExtendedAPIGatewayEvent {
        const rval: ExtendedAPIGatewayEvent = Object.assign({}, event) as ExtendedAPIGatewayEvent;
        // Default all the key maps
        if (!rval.queryStringParameters && !routeMap.disableQueryMapAssure) {
            rval.queryStringParameters = {};
        }
        if (!rval.headers && !routeMap.disableHeaderMapAssure) {
            rval.headers = {};
        }
        if (!rval.pathParameters && !routeMap.disablePathMapAssure) {
            rval.pathParameters = {};
        }
        if (event.body && !routeMap.disableAutomaticBodyParse) {
            rval.parsedBody = EventUtil.bodyObject(rval);
        }

        return rval;
    }

    private async applyBodyObjectValidation(event: ExtendedAPIGatewayEvent, route: RouteMapping): Promise<boolean> {
        if (!event || !route) {
            throw new MisconfiguredError('Missing event or route');
        }
        let rval: boolean = true;

        if (route.validation) {
            if (!this.routerConfig.modelValidator) {
                throw new MisconfiguredError('Requested body validation but supplied no validator');
            }
            const errors: string[] = this.routerConfig.modelValidator.validate(route.validation.modelName,
                event.parsedBody,
                route.validation.emptyAllowed, route.validation.extraPropertiesAllowed);
            if (errors.length > 0) {
                Logger.info('Found errors while validating %s object %j', route.validation.modelName, errors);
                const newError: BadRequestError = new BadRequestError(...errors);
                rval = false;
                throw newError;
            }
        }
        return rval;
    }

    // Returns a failing proxy result if no auth, otherwise returns null
    private async applyAuth(event: APIGatewayEvent, route: RouteMapping): Promise<boolean> {
        if (!event || !route) {
            throw new MisconfiguredError('Missing event or route');
        }
        let rval: boolean = true;

        if (route.authorizerName) {
            if (!this.routerConfig.webTokenManipulator) {
                throw new MisconfiguredError('Auth is defined, but token manipulator not set');
            }
            // Extract the token
            const token: CommonJwtToken<any> = await this.routerConfig.webTokenManipulator.extractTokenFromStandardEvent(event);
            if (!token) {
                Logger.info('Failed auth for route : %s - missing/bad token', route.path);
                rval = false; // Not that it matters
                throw new UnauthorizedError('Missing or bad token');
            } else {
                const authorizer: AuthorizerFunction = this.routerConfig.authorizers.get(route.authorizerName);
                if (!authorizer) {
                    throw new MisconfiguredError('Route requires authorizer ' + route.authorizerName + ' but its not in the config');
                }

                if (authorizer) {
                    const passes: boolean = await authorizer(token, event, route);
                    if (!passes) {
                        rval = false;
                        throw new ForbiddenError('Failed authorization');
                    }
                }
            }

            if (rval) {
                // Put the token into scope just like it would be from a AWS authorizer
                const newAuth: ExtendedAuthResponseContext = Object.assign({}, event.requestContext.authorizer) as
                    ExtendedAuthResponseContext;
                newAuth.userData = token;
                newAuth.userDataJSON = (token) ? JSON.stringify(token) : null;
                newAuth.srcData = WebTokenManipulatorUtil.extractTokenStringFromStandardEvent(event);
                event.requestContext.authorizer = newAuth;
            }
        }

        return rval;
    }

}

export interface RouteAndParse {
    mapping: RouteMapping;
    route: Route;
    parsed: any;
}