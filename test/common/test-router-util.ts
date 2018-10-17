import {expect} from 'chai';
import {RouterConfig} from '../../src/route/router-config';
import {RouterUtil} from '../../src/route/router-util';
import {WebHandler} from '../../src/web-handler';
import {APIGatewayEvent} from 'aws-lambda';
import {EventUtil} from '../../src/event-util';
import {createSampleRouterConfig} from '../../src/local-server';

describe('#routerUtilApplyOpenApiDoc', function() {

    it('should create a router config from a yaml file', function() {
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
        return webHandler.findHandler(evt, false).then(find => {
            expect(find).to.not.be.null;
        });
    });

    it('should reformat a path to match the other library', function() {
        const inString: string = '/meta/item/{itemId}';
        const outString: string = RouterUtil.openApiPathToRouteParserPath(inString);
        expect(outString).to.equal('/meta/item/:itemId');
    });


    it('should correctly calculate stages', function() {
        // TODO: move this to its own test
        const evt: APIGatewayEvent = {
            httpMethod: 'get',
            path: '/cw/meta/server',
            requestContext: {
                stage: 'v0'
            }
        } as APIGatewayEvent;

        expect(EventUtil.extractStage(evt)).to.equal('cw');
        expect(EventUtil.extractApiGatewayStage(evt)).to.equal('v0');
    });

});