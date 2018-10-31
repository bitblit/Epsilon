import {expect} from 'chai';
import {APIGatewayEvent, APIGatewayEventRequestContext, ProxyResult} from 'aws-lambda';
import {BadRequestError} from '../../src/api-gateway/error/bad-request-error';
import {ResponseUtil} from '../../src/api-gateway/response-util';
import {EventUtil} from '../../src/api-gateway/event-util';
import * as fs from 'fs';


describe('#errorToProxyResult', function() {

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


});