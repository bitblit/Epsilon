import { expect } from 'chai';
import {ProxyResult} from 'aws-lambda';
import {WebHandler} from '../../src/web-handler';

describe('#errorToProxyResult', function() {
    it('should set the default status code to 500', function() {

        let err:Error = new Error('this is a test');
        let res:ProxyResult = WebHandler.errorToProxyResult(err);

        expect(res.statusCode).to.equal(500);
    });

});