import { expect } from 'chai';
import { EpsilonHttpError } from '../../../src/http/error/epsilon-http-error';

describe('#epsilonHttpError', function () {
  it('chould check if the error is a given class', async () => {
    const testError: Error = new EpsilonHttpError('test').withHttpStatusCode(404);
    const nonHttpError: Error = new Error('Not HTTP');
    expect(EpsilonHttpError.errorIs40x(testError)).to.be.true;
    expect(EpsilonHttpError.errorIs50x(testError)).to.be.false;
    expect(EpsilonHttpError.errorIs40x(nonHttpError)).to.be.false;
    expect(EpsilonHttpError.errorIs50x(testError)).to.be.false;
  });
});
