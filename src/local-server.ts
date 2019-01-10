import {RouterConfig} from './api-gateway/route/router-config';
import {APIGatewayEvent, APIGatewayEventRequestContext, ProxyResult} from 'aws-lambda';
import {Logger} from '@bitblit/ratchet/dist/common/logger';
import * as http from 'http';
import {IncomingMessage, Server, ServerResponse} from 'http';
import {WebHandler} from './api-gateway/web-handler';
import {PromiseRatchet} from '@bitblit/ratchet/dist/common/promise-ratchet';
import {StringRatchet} from '@bitblit/ratchet/dist/common/string-ratchet';
import * as moment from 'moment-timezone';
import * as qs from 'querystring';
import {AuthorizerFunction} from './api-gateway/route/authorizer-function';
import {HandlerFunction} from './api-gateway/route/handler-function';
import {SimpleRoleRouteAuth} from './api-gateway/auth/simple-role-route-auth';
import {RouterUtil} from './api-gateway/route/router-util';
import * as fs from 'fs';
import * as path from 'path';
import {BuiltInHandlers} from './api-gateway/route/built-in-handlers';

/**
 * A simplistic server for testing your lambdas locally
 */
export class LocalServer {
    private server: Server;
    private webHandler: WebHandler;
    private aborted: boolean = false;

    constructor(private routerConfig: RouterConfig, private port: number = 8888) {
        this.webHandler = new WebHandler(routerConfig);
    }

    async runServer(): Promise<boolean> {
        Logger.info('Starting Epsilon server on port %d', this.port);
        this.server = http.createServer(this.requestHandler.bind(this));
        this.server.listen(this.port, (err) => {
            if (err) {
                Logger.error('Error serving : %s', err, err);
                return console.error('Something bad happened', err);
            }
        });
        Logger.info('Epsilon server is listening');

        // Also listen for SIGINT
        process.on('SIGINT', () => {
            Logger.info('Caught SIGINT - shutting down test server...');
            this.aborted = true;
        });

        return this.checkFinished();
    }

    async checkFinished(): Promise<boolean> {
        if (this.aborted) {
            return true;
        } else {
            const wait: any = await PromiseRatchet.createTimeoutPromise('Wait', 1000, true, false);
            return this.checkFinished();
        }
    }

    async requestHandler(request: IncomingMessage, response: ServerResponse): Promise<any> {
        const evt: APIGatewayEvent = await this.messageToApiGatewayEvent(request);
        Logger.info('Processing event: %j', evt);

        if (evt.path == '/epsilon-poison-pill') {
            this.aborted = true;
            return true;
        } else {
            const result: ProxyResult = await this.webHandler.lambdaHandler(evt);
            const written: boolean = await this.writeProxyResultToServerResponse(result, response);
            return written;
        }
    }

    private async bodyAsBase64String(request: IncomingMessage): Promise<string> {
        return new Promise<string>((res, rej) => {
            let body = [];
            request.on('data', (chunk) => {
                body.push(chunk);
            });
            request.on('end', () => {
                const rval: string = Buffer.concat(body).toString('base64');
                res(rval);
            })

        });
    }

    private async messageToApiGatewayEvent(request: IncomingMessage): Promise<APIGatewayEvent> {

        const bodyString: string = await this.bodyAsBase64String(request);
        const stageIdx: number = request.url.indexOf('/', 1);
        const stage: string = request.url.substring(1, stageIdx);
        const path: string = request.url.substring(stageIdx + 1);

        const reqTime: number = new Date().getTime();
        const formattedTime: string = moment.tz(reqTime, 'UTC').format('DD/MMM/YYYY:hh:mm:ss ZZ');
        const queryIdx: number = request.url.indexOf('?');
        const queryStringParams: any = (queryIdx > -1) ? qs.parse(request.url.substring(queryIdx + 1)) : {};

        const rval: APIGatewayEvent = {
            body: bodyString,
            resource: '/{proxy+}',
            path: request.url,
            httpMethod: request.method.toLowerCase(),
            isBase64Encoded: true,
            queryStringParameters: queryStringParams,
            pathParameters: {
                proxy: path
            },
            stageVariables: {
                baz: 'qux'
            },
            headers: request.headers,
            requestContext: {
                accountId: '123456789012',
                resourceId: '123456',
                stage: stage,
                requestId: StringRatchet.createType4Guid(),
                requestTime: formattedTime, // '09/Apr/2015:12:34:56 +0000',
                requestTimeEpoch: reqTime, //1428582896000,
                identity: null,
                /*
                identity: {
                    apiKey: null,
                    cognitoIdentityPoolId: null,
                    accountId: null,
                    cognitoIdentityId: null,
                    caller: null,
                    accessKey: null,
                    sourceIp: '127.0.0.1',
                    cognitoAuthenticationType: null,
                    cognitoAuthenticationProvider: null,
                    userArn: null,
                    userAgent: 'Custom User Agent String',
                    user: null
                },
                */
                path: request.url, // /prod/path/to/resource
                resourcePath: '/{proxy+}',
                httpMethod: request.method.toLowerCase(),
                apiId: '1234567890',
                protocol: 'HTTP/1.1'
            } as APIGatewayEventRequestContext
        } as APIGatewayEvent;

        return rval;
    }

    private async writeProxyResultToServerResponse(proxyResult: ProxyResult, response: ServerResponse): Promise<boolean> {
        Logger.info('d:%j', proxyResult);

        response.statusCode = proxyResult.statusCode;
        if (proxyResult.headers) {
            Object.keys(proxyResult.headers).forEach(hk => {
                response.setHeader(hk, String(proxyResult.headers[hk]));
            });
        }
        const toWrite:Buffer = (proxyResult.isBase64Encoded)?Buffer.from(proxyResult.body, 'base64') : Buffer.from(proxyResult.body);

        response.end(toWrite);
        return !!proxyResult.body;
    }
}


// Functions below here are for using as samples

export function createSampleRouterConfig(): RouterConfig {
    const yamlString: string = loadSampleOpenApiYaml();
    const authorizers: Map<string, AuthorizerFunction> = new Map<string, AuthorizerFunction>();
    const handlers: Map<string, HandlerFunction<any>> = new Map<string, HandlerFunction<any>>();
    const simpleRouteAuth: SimpleRoleRouteAuth = new SimpleRoleRouteAuth(['USER'], []);
    authorizers.set('SampleAuthorizer', (token, event, route) => simpleRouteAuth.handler(token, event, route));
    handlers.set('get /', (event) => BuiltInHandlers.sample(event));
    handlers.set('get /meta/server', (event) => BuiltInHandlers.sample(event));
    handlers.set('get /meta/user', (event) => BuiltInHandlers.sample(event));
    handlers.set('get /meta/item/{itemId}', (event) => BuiltInHandlers.sample(event));
    handlers.set('post /secure/access-token', (event) => BuiltInHandlers.sample(event));

    handlers.set('get /multi/fixed', (event) => BuiltInHandlers.sample(event, 'fixed'));
    handlers.set('get /multi/{v}', (event) => BuiltInHandlers.sample(event, 'variable'));

    const cfg: RouterConfig = RouterUtil.openApiYamlToRouterConfig(yamlString, handlers, authorizers);
    return cfg;
}

export function loadSampleOpenApiYaml(): string {
    const yamlString: string = fs.readFileSync(path.join(__dirname, 'static', 'sample-open-api-doc.yaml')).toString();
    return yamlString;
}
