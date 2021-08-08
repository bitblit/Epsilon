import { RouterUtil } from './router-util';
import { RouteAndParse } from '../web-handler';
import { APIGatewayEvent, Context, ProxyResult } from 'aws-lambda';
import fs from 'fs';
import path from 'path';
import { Logger } from '@bitblit/ratchet/dist/common';
import { EpsilonGlobalHandler } from '../../epsilon-global-handler';
import { SampleServerComponents } from '../../sample/sample-server-components';
import { ExtendedAPIGatewayEvent } from './extended-api-gateway-event';

describe('#routerUtilApplyOpenApiDoc', function () {
  it('should create a router config from a yaml file', async () => {
    const inst: EpsilonGlobalHandler = await SampleServerComponents.createSampleEpsilonGlobalHandler();

    expect(inst.epsilon.modelValidator).toBeTruthy();
    expect(inst.epsilon.modelValidator.fetchModel('AccessTokenRequest')).toBeTruthy();

    // TODO: move this to its own test
    const evt: APIGatewayEvent = {
      httpMethod: 'get',
      path: '/v0/meta/server',
      requestContext: {
        stage: 'v0',
      },
    } as APIGatewayEvent;

    const find: RouteAndParse = await inst.epsilon.webHandler.findBestMatchingRoute(evt);
    expect(find).toBeTruthy();
  });

  it('should find the most specific route and the least specific', async () => {
    const inst: EpsilonGlobalHandler = await SampleServerComponents.createSampleEpsilonGlobalHandler();

    expect(inst.epsilon.modelValidator).toBeTruthy();

    // TODO: move this to its own test
    const evtFixed: ExtendedAPIGatewayEvent = {
      httpMethod: 'get',
      path: '/v0/multi/fixed',
      requestContext: {
        stage: 'v0',
      },
      queryStringParameters: {},
    } as ExtendedAPIGatewayEvent;

    const evtVar: ExtendedAPIGatewayEvent = {
      httpMethod: 'get',
      path: '/v0/multi/xyz',
      requestContext: {
        stage: 'v0',
      },
      queryStringParameters: {},
    } as ExtendedAPIGatewayEvent;

    const findFixedRP: RouteAndParse = await inst.epsilon.webHandler.findBestMatchingRoute(evtFixed);
    const findVariableRP: RouteAndParse = await inst.epsilon.webHandler.findBestMatchingRoute(evtVar);
    const findFixed: ProxyResult = await inst.epsilon.webHandler.findHandler(findFixedRP, evtFixed, {} as Context, false);
    const findVariable: ProxyResult = await inst.epsilon.webHandler.findHandler(findVariableRP, evtVar, {} as Context, false);
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
