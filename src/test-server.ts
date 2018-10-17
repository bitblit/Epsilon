import {RouterConfig} from './route/router-config';
import {APIGatewayEvent, APIGatewayEventRequestContext, ProxyResult} from 'aws-lambda';
import {Logger} from '@bitblit/ratchet/dist/common/logger';
import * as http from 'http';
import {IncomingMessage, Server, ServerResponse} from 'http';
import {WebHandler} from './web-handler';
import {PromiseRatchet} from '@bitblit/ratchet/dist/common/promise-ratchet';

/**
 * A simplistic server for testing your lambdas locally
 */
export class TestServer {
    private server: Server;
    private webHandler: WebHandler;
    private aborted: boolean = false;

    constructor(private routerConfig: RouterConfig, private stage: string = 'Prod', private port: number = 8888) {
        this.webHandler = new WebHandler(routerConfig);
    }

    async runServer(): Promise<boolean>{
        Logger.info('Starting Epsilon server on port %d', this.port);
        this.server = http.createServer(this.requestHandler.bind(this));
        this.server.listen(this.port, (err) => {
            if (err) {
                Logger.error('Error serving : %s', err, err);
                return console.error('Something bad happened', err);
            }
        });
        Logger.info('Epsilon server is listening');
        return this.checkFinished();
    }

    async checkFinished(): Promise<boolean> {
        if (this.aborted) {
            return true;
        } else {
            const wait: any = await PromiseRatchet.createTimeoutPromise('Wait', 2500, true, false);
            return this.checkFinished();
        }
    }

    async requestHandler(request: IncomingMessage, response: ServerResponse): Promise<any> {
        const evt: APIGatewayEvent = await this.messageToApiGatewayEvent(request);
        Logger.info('Processing event: %j',evt);

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
        return new Promise<string>((res,rej) => {
            let body = [];
            request.on('data', (chunk) => {
                body.push(chunk);
            });
            request.on('end', () =>{
                const rval: string = Buffer.concat(body).toString('base64');
                res(rval);
            })

        });
    }

    private async messageToApiGatewayEvent(request: IncomingMessage): Promise<APIGatewayEvent> {

        const bodyString: string = await this.bodyAsBase64String(request);
        const stageIdx: number = request.url.indexOf('/',1);
        const stage: string = request.url.substring(1, stageIdx);
        const path: string = request.url.substring(stageIdx+1);


        const rval: APIGatewayEvent = {
            body: bodyString,
            resource: '/{proxy+}',
            path: path, // /meta/server
            httpMethod: request.method.toLowerCase(),
            isBase64Encoded: true,
            queryStringParameters: {
                foo: 'bar'
            },
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
                stage: 'prod',
                requestId: 'c6af9ac6-7b61-11e6-9a41-93e8deadbeef',
                requestTime: '09/Apr/2015:12:34:56 +0000',
                requestTimeEpoch: 1428582896000,
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
        response.end(proxyResult.body);
        return !!proxyResult.body;
    }
}
