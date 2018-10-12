import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {RouterConfig} from '../../src/route/router-config';
import {RouterUtil} from '../../src/route/router-util';
import {AuthorizerFunction} from '../../src/route/authorizer-function';
import {SimpleRoleRouteAuth} from '../../src/simple-role-route-auth';
import {HandlerFunction} from '../../src/route/handler-function';
import {ExtendedAPIGatewayEvent} from '../../src/route/extended-api-gateway-event';

describe('#routerUtilApplyOpenApiDoc', function() {

    it('should create a router config from a yaml file', function() {
        const yamlString: string = fs.readFileSync(path.join(__dirname, 'test-open-api-doc.yaml')).toString();

        const authorizers: Map<string, AuthorizerFunction> = new Map<string, AuthorizerFunction>();
        const handlers: Map<string, HandlerFunction<any>> = new Map<string, HandlerFunction<any>>();
        const simpleRouteAuth: SimpleRoleRouteAuth = new SimpleRoleRouteAuth(['USER'],[]);
        authorizers.set('SampleAuthorizer', (token, event, route) => simpleRouteAuth.handler(token, event, route));
        const fakeHandler: HandlerFunction<any> = function (evt: ExtendedAPIGatewayEvent): Promise<boolean> {
            return Promise.resolve(true);
        }
        handlers.set('get /', (event) => fakeHandler(event));
        handlers.set('get /meta/server', (event) => fakeHandler(event));
        handlers.set('get /meta/user', (event) => fakeHandler(event));
        handlers.set('get /meta/item/{itemId}', (event) => fakeHandler(event));
        handlers.set('post /secure/access-token', (event) => fakeHandler(event));

        const cfg: RouterConfig = RouterUtil.openApiYamlToRouterConfig(yamlString, handlers, authorizers);

        expect(cfg.modelValidator).to.not.be.null;
        expect(cfg.modelValidator.fetchModel('AccessTokenRequest')).to.not.be.null;
    });

    it('should reformat a path to match the other library', function() {
        const inString: string = '/meta/item/{itemId}';
        const outString: string = RouterUtil.openApiPathToRouteParserPath(inString);
        expect(outString).to.equal('/meta/item/:itemId');
    });

});