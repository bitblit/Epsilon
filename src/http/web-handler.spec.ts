import { APIGatewayEvent, APIGatewayEventRequestContext, Context, ProxyResult } from 'aws-lambda';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { SampleServerComponents } from '../sample-server-components';
import { EpsilonInstance } from '../global/epsilon-instance';

describe('#errorToProxyResult', function () {
  /*
    it('should set the default status code to 500', function() {

        let err:Error = new BadRequestError('this is a test','a1','a2');
        let res:ProxyResult = ResponseUtil.errorToProxyResult(err);

        expect(res.statusCode).toEqual(400);
    });

    it('should parse a request body correctly', function() {

        let evt:APIGatewayEvent = {
            httpMethod:'post',
            path:'/test',
            pathParameters: null,
            queryStringParameters: null,
            stageVariables:null,
            requestContext:{} as APIGatewayEventRequestContext,
            resource:'/test',
            headers: {
                'content-type':'application/json'
            },
            isBase64Encoded: true,
            body: 'ew0KICJtZXNzYWdlIiA6ICJ0aGlzIGlzIGEgdGVzdCIsDQogIm51bWJlciIgOiAxDQp9'

        } as APIGatewayEvent;

        let body = EventUtil.bodyObject(evt);
        expect(body).toBeTruthy();
        expect(body.message).toEqual('this is a test');
        expect(body.number).toEqual(1);

    });

    it('should parse a request body correctly part 2', function() {

        let evt:APIGatewayEvent = {
            httpMethod:'post',
            path:'/test',
            pathParameters: null,
            queryStringParameters: null,
            stageVariables:null,
            requestContext:{} as APIGatewayEventRequestContext,
            resource:'/test',
            headers: {
                'content-type':'application/json; charset=UTF-8'
            },
            isBase64Encoded: true,
            body: 'ew0KICJtZXNzYWdlIiA6ICJ0aGlzIGlzIGEgdGVzdCIsDQogIm51bWJlciIgOiAxDQp9'

        } as APIGatewayEvent;

        let body = EventUtil.bodyObject(evt);
        expect(body).toBeTruthy();
        expect(body.message).toEqual('this is a test');
        expect(body.number).toEqual(1);
    });
    */

  it('should gzip responses correctly', async () => {
    const inst: EpsilonInstance = await SampleServerComponents.createSampleEpsilonInstance();

    expect(inst.modelValidator).toBeTruthy();

    const evt: APIGatewayEvent = {
      httpMethod: 'get',
      multiValueHeaders: {},
      multiValueQueryStringParameters: {},
      path: '/meta/server',
      pathParameters: null,
      queryStringParameters: null,
      stageVariables: null,
      requestContext: {} as APIGatewayEventRequestContext,
      resource: '/meta/server',
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'accept-encoding': 'gzip, deflate, br',
      },
      isBase64Encoded: true,
      body: null,
    } as APIGatewayEvent;

    Logger.setLevelByName('silly');
    const result: ProxyResult = await inst.webHandler.lambdaHandler(evt, {} as Context);

    expect(result).toBeTruthy();
    expect(result.isBase64Encoded).toEqual(true);
    expect(result.headers).toBeTruthy();
    expect(result.headers['Content-Encoding']).toEqual('gzip');
  });
});
