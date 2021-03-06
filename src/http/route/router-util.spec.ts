import { RouterConfig } from './router-config';
import { RouterUtil } from './router-util';
import { RouteAndParse, WebHandler } from '../web-handler';
import { APIGatewayEvent, Context, ProxyResult } from 'aws-lambda';
import fs from 'fs';
import path from 'path';
import { Logger } from '@bitblit/ratchet/dist/common';
import { SampleServerComponents } from '../../sample-server-components';

describe('#routerUtilApplyOpenApiDoc', function () {
  it('should create a router config from a yaml file', async () => {
    const cfg: RouterConfig = await SampleServerComponents.createSampleRouterConfig();

    expect(cfg.modelValidator).toBeTruthy();
    expect(cfg.modelValidator.fetchModel('AccessTokenRequest')).toBeTruthy();

    // TODO: move this to its own test
    const evt: APIGatewayEvent = {
      httpMethod: 'get',
      path: '/v0/meta/server',
      requestContext: {
        stage: 'v0',
      },
    } as APIGatewayEvent;

    cfg.prefixesToStripBeforeRouteMatch = ['v0'];
    const webHandler: WebHandler = new WebHandler(cfg);
    const find: RouteAndParse = await webHandler.findBestMatchingRoute(evt);
    expect(find).toBeTruthy();
  });

  it('should find the most specific route and the least specific', async () => {
    const cfg: RouterConfig = await SampleServerComponents.createSampleRouterConfig();

    expect(cfg.modelValidator).toBeTruthy();

    // TODO: move this to its own test
    const evtFixed: APIGatewayEvent = {
      httpMethod: 'get',
      path: '/v0/multi/fixed',
      requestContext: {
        stage: 'v0',
      },
    } as APIGatewayEvent;

    const evtVar: APIGatewayEvent = {
      httpMethod: 'get',
      path: '/v0/multi/xyz',
      requestContext: {
        stage: 'v0',
      },
    } as APIGatewayEvent;

    cfg.prefixesToStripBeforeRouteMatch = ['v0'];

    const webHandler: WebHandler = new WebHandler(cfg);

    const findFixedRP: RouteAndParse = await webHandler.findBestMatchingRoute(evtFixed);
    const findVariableRP: RouteAndParse = await webHandler.findBestMatchingRoute(evtVar);
    const findFixed: ProxyResult = await webHandler.findHandler(findFixedRP, evtFixed, {} as Context, false);
    const findVariable: ProxyResult = await webHandler.findHandler(findVariableRP, evtVar, {} as Context, false);
    expect(findFixed).toBeTruthy();
    expect(findFixed['flag']).toEqual('fixed');
    expect(findVariable).toBeTruthy();
    expect(findVariable['flag']).toEqual('variable');
    Logger.info('done');
  });

  it('should reformat a path to match the other library', function () {
    const inString: string = '/meta/item/{itemId}';
    const outString: string = RouterUtil.openApiPathToRouteParserPath(inString);
    expect(outString).toEqual('/meta/item/:itemId');
  });

  it('should build default reflective cors handler', async () => {
    const evt: APIGatewayEvent = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../../test-data/sample-json/sample-request-1.json')).toString()
    );
    const proxy: ProxyResult = RouterUtil.defaultReflectiveCorsOptionsFunction(evt);

    expect(proxy.headers).toBeTruthy();
  });
});
