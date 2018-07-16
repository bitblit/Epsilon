import { expect } from 'chai';
import {APIGatewayEvent, APIGatewayEventRequestContext, ProxyResult} from 'aws-lambda';
import {WebHandler} from '../../src/web-handler';
import {BadRequestError} from '../../src/error/bad-request-error';

describe('#errorToProxyResult', function() {
    it('should set the default status code to 500', function() {

        let err:Error = new BadRequestError('this is a test','a1','a2');
        let res:ProxyResult = WebHandler.errorToProxyResult(err);

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

        let body = WebHandler.bodyObject(evt);
        expect(body).to.not.be.null;
        expect(body.message).to.equal('this is a test');
        expect(body.number).to.equal(1);

    });

});