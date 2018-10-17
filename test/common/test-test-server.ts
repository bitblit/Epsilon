import { expect } from 'chai';
import * as fs from "fs";
import * as path from "path";
import {AuthorizerFunction} from '../../src/route/authorizer-function';
import {HandlerFunction} from '../../src/route/handler-function';
import {SimpleRoleRouteAuth} from '../../src/auth/simple-role-route-auth';
import {ExtendedAPIGatewayEvent} from '../../src/route/extended-api-gateway-event';
import {RouterConfig} from '../../src/route/router-config';
import {RouterUtil} from '../../src/route/router-util';
import {TestServer} from '../../src/test-server';
import {Logger} from '@bitblit/ratchet/dist/common/logger';


describe('#testServer', function() {

    it('should run a test server', function() {
        this.timeout(30000000000);

        if (process.env['EPSILON_TEST_SERVER']) {
            const yamlString: string = fs.readFileSync(path.join(__dirname, 'test-open-api-doc.yaml')).toString();

            const authorizers: Map<string, AuthorizerFunction> = new Map<string, AuthorizerFunction>();
            const handlers: Map<string, HandlerFunction<any>> = new Map<string, HandlerFunction<any>>();
            const simpleRouteAuth: SimpleRoleRouteAuth = new SimpleRoleRouteAuth(['USER'],[]);
            authorizers.set('SampleAuthorizer', (token, event, route) => simpleRouteAuth.handler(token, event, route));
            const fakeHandler: HandlerFunction<any> = function (evt: ExtendedAPIGatewayEvent): Promise<any> {
                const rval: any = {
                    time: new Date().toLocaleString(),
                    evt: evt
                }
                return Promise.resolve(rval);
            };
            handlers.set('get /', (event) => fakeHandler(event));
            handlers.set('get /meta/server', (event) => fakeHandler(event));
            handlers.set('get /meta/user', (event) => fakeHandler(event));
            handlers.set('get /meta/item/{itemId}', (event) => fakeHandler(event));
            handlers.set('post /secure/access-token', (event) => fakeHandler(event));

            const cfg: RouterConfig = RouterUtil.openApiYamlToRouterConfig(yamlString, handlers, authorizers);

            const testServer: TestServer = new TestServer(cfg);
            return testServer.runServer().then(res=> {
                Logger.info('Got res server')
            })
        } else {
            Logger.info('Skipping test server test');
            expect(true).to.equal(true);
            return true;
        }

    });


});