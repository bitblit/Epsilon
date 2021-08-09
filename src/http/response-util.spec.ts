import { APIGatewayEvent, APIGatewayEventRequestContext, ProxyResult } from 'aws-lambda';
import { ResponseUtil } from './response-util';
import path from 'path';
import fs from 'fs';
import { FilterChainContext } from '../config/http/filter-chain-context';
import { ExtendedAPIGatewayEvent } from '../config/http/extended-api-gateway-event';
import { BuiltInFilters } from '../built-in/http/built-in-filters';
import { EpsilonConstants } from '../epsilon-constants';

describe('#responseUtil', function () {
  it('should correctly combine a redirect url and query params', function () {
    const evt: APIGatewayEvent = {
      httpMethod: 'get',
      multiValueHeaders: {},
      multiValueQueryStringParameters: {},
      path: '/v0/meta/server',
      body: null,
      headers: null,
      isBase64Encoded: false,
      pathParameters: null,
      stageVariables: null,
      resource: null,
      queryStringParameters: {
        a: 'b',
        c: 'd',
      },
      requestContext: {
        stage: 'v0',
      } as APIGatewayEventRequestContext,
    } as APIGatewayEvent;

    const out1: ProxyResult = ResponseUtil.redirect('myTarget?e=f', 301, evt.queryStringParameters);
    expect(out1).toBeTruthy();
    expect(out1.headers).toBeTruthy();
    expect(out1.headers.Location).toEqual('myTarget?e=f&a=b&c=d');

    const out2: ProxyResult = ResponseUtil.redirect('myTarget', 301, evt.queryStringParameters);
    expect(out2).toBeTruthy();
    expect(out2.headers).toBeTruthy();
    expect(out2.headers.Location).toEqual('myTarget?a=b&c=d');
  });

  it('should leave already encoded stuff alone', async () => {
    const singlePixel: string = fs.readFileSync(path.join(__dirname, '../../test-data/test.png')).toString('base64');

    const temp: ProxyResult = {
      body: singlePixel,
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'content-type': 'application/zip',
        'content-disposition': 'attachment; filename="adomni_bs_' + new Date().getTime() + '.zip"',
      },
    } as ProxyResult;

    const cast: ProxyResult = ResponseUtil.coerceToProxyResult(temp);
    expect(cast.body).toEqual(temp.body);

    const gzip: ProxyResult = await ResponseUtil.applyGzipIfPossible('gzip', cast);
    expect(cast.body).toEqual(gzip.body);
  });

  it('should add cors to proxy result MATCH 1', async () => {
    const evt: ExtendedAPIGatewayEvent = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../test-data/sample-json/sample-request-1.json')).toString()
    );
    const proxy: ProxyResult = {} as ProxyResult;
    const fCtx: FilterChainContext = {
      event: evt,
      rawResult: null,
      context: null,
      result: proxy,
      routeAndParse: null,
      modelValidator: null,
      authenticators: null,
    };

    await BuiltInFilters.addAllowReflectionCORSHeaders(fCtx);

    expect(proxy.headers).toBeTruthy();
    expect(proxy.headers['Access-Control-Allow-Origin']).toEqual('http://localhost:4200');
    expect(proxy.headers['Access-Control-Allow-Methods']).toEqual('GET');
    expect(proxy.headers['Access-Control-Allow-Headers']).toEqual(EpsilonConstants.AUTH_HEADER_NAME.toLowerCase());
  });

  it('should add cors to proxy result MATCH 2', async () => {
    const evt: ExtendedAPIGatewayEvent = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../test-data/sample-json/sample-request-2.json')).toString()
    );
    const proxy: ProxyResult = {} as ProxyResult;
    const fCtx: FilterChainContext = {
      event: evt,
      rawResult: null,
      context: null,
      result: proxy,
      routeAndParse: null,
      modelValidator: null,
      authenticators: null,
    };

    await BuiltInFilters.addAllowReflectionCORSHeaders(fCtx);

    expect(proxy.headers).toBeTruthy();
  });
});
