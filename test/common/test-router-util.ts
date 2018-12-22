import {expect} from 'chai';
import {RouterConfig} from '../../src/api-gateway/route/router-config';
import {RouterUtil} from '../../src/api-gateway/route/router-util';
import {WebHandler} from '../../src/api-gateway/web-handler';
import {APIGatewayEvent, ProxyResult} from 'aws-lambda';
import {EventUtil} from '../../src/api-gateway/event-util';
import {createSampleRouterConfig} from '../../src/local-server';

describe('#routerUtilApplyOpenApiDoc', function() {

    it('should create a router config from a yaml file', async() => {
        const cfg: RouterConfig = createSampleRouterConfig();

        expect(cfg.modelValidator).to.not.be.null;
        expect(cfg.modelValidator.fetchModel('AccessTokenRequest')).to.not.be.null;

        // TODO: move this to its own test
        const evt: APIGatewayEvent = {
            httpMethod: 'get',
            path: '/v0/meta/server',
            requestContext: {
                stage: 'v0'
            }
        } as APIGatewayEvent;

        cfg.prefixesToStripBeforeRouteMatch = ['v0'];
        const webHandler: WebHandler = new WebHandler(cfg);
        const find: ProxyResult = await webHandler.findHandler(evt, false);
        expect(find).to.not.be.null;
    });

    it('should find the most specific route and the least specific', async() => {
        const cfg: RouterConfig = createSampleRouterConfig();

        expect(cfg.modelValidator).to.not.be.null;

        // TODO: move this to its own test
        const evtFixed: APIGatewayEvent = {
            httpMethod: 'get',
            path: '/v0/multi/fixed',
            requestContext: {
                stage: 'v0'
            }
        } as APIGatewayEvent;

        const evtVar: APIGatewayEvent = {
            httpMethod: 'get',
            path: '/v0/multi/xyz',
            requestContext: {
                stage: 'v0'
            }
        } as APIGatewayEvent;

        cfg.prefixesToStripBeforeRouteMatch = ['v0'];
        const webHandler: WebHandler = new WebHandler(cfg);

        const findFixed: ProxyResult = await webHandler.findHandler(evtFixed, false);
        const findVariable: ProxyResult = await webHandler.findHandler(evtVar, false);
        expect(findFixed).to.not.be.null;
        expect(findFixed['flag']).to.eq('fixed');
        expect(findVariable).to.not.be.null;
        expect(findVariable['flag']).to.eq('variable');
    });

    it('should reformat a path to match the other library', function() {
        const inString: string = '/meta/item/{itemId}';
        const outString: string = RouterUtil.openApiPathToRouteParserPath(inString);
        expect(outString).to.equal('/meta/item/:itemId');
    });



});