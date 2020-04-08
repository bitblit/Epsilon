import {expect} from 'chai';
import {APIGatewayEvent, APIGatewayEventRequestContext, Context, ProxyResult} from 'aws-lambda';
import {BadRequestError} from '../../src/api-gateway/error/bad-request-error';
import {ResponseUtil} from '../../src/api-gateway/response-util';
import {EventUtil} from '../../src/api-gateway/event-util';
import * as fs from 'fs';
import {createSampleRouterConfig, loadSampleOpenApiYaml} from '../../src/local-server';
import {ModelValidator} from '../../src/api-gateway/route/model-validator';
import {RouterConfig} from '../../src/api-gateway/route/router-config';
import {WebHandler} from '../../src/api-gateway/web-handler';
import {Logger} from '@bitblit/ratchet/dist/common/logger';


describe('#errorToProxyResult', function() {

    /*
    it('should set the default status code to 500', function() {

        let err:Error = new BadRequestError('this is a test','a1','a2');
        let res:ProxyResult = ResponseUtil.errorToProxyResult(err);

        expect(res.statusCode).to.equal(400);
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
        expect(body).to.not.be.null;
        expect(body.message).to.equal('this is a test');
        expect(body.number).to.equal(1);

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
        expect(body).to.not.be.null;
        expect(body.message).to.equal('this is a test');
        expect(body.number).to.equal(1);
    });
    */


    it('should gzip responses correctly', async() => {

        const cfg: RouterConfig = createSampleRouterConfig();
        const webHandler: WebHandler = new WebHandler(cfg);

        expect(cfg.modelValidator).to.not.be.null;

        let evt:APIGatewayEvent = {
            httpMethod:'get',
            multiValueHeaders: {},
            multiValueQueryStringParameters: {},
            path:'/meta/server',
            pathParameters: null,
            queryStringParameters: null,
            stageVariables:null,
            requestContext:{} as APIGatewayEventRequestContext,
            resource:'/meta/server',
            headers: {
                'content-type':'application/json; charset=UTF-8',
                'accept-encoding': 'gzip, deflate, br'
            },
            isBase64Encoded: true,
            body: null

        } as APIGatewayEvent;


        Logger.setLevelByName('silly');
        const result: ProxyResult = await webHandler.lambdaHandler(evt,{} as Context);

        expect(result).to.not.be.null;
        expect(result.isBase64Encoded).to.eq(true);
        expect(result.headers).to.not.be.null;
        expect(result.headers['Content-Encoding']).to.equal('gzip');
    });




});
