import { expect } from 'chai';
import {ProxyResult} from 'aws-lambda';
import {WebHandler} from '../../src/web-handler';
import {BadRequestError} from '../../src/error/bad-request-error';

describe('#errorToProxyResult', function() {
    it('should set the default status code to 500', function() {

        let err:Error = new BadRequestError('this is a test','a1','a2');
        let res:ProxyResult = WebHandler.errorToProxyResult(err);

        expect(res.statusCode).to.equal(400);
    });

});