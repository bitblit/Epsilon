import { EpsilonHttpError } from './epsilon-http-error';

describe('#epsilonHttpError', function () {
  it('chould check if the error is a given class', async () => {
    const testError: Error = new EpsilonHttpError('test').withHttpStatusCode(404);
    const nonHttpError: Error = new Error('Not HTTP');
    expect(EpsilonHttpError.errorIs40x(testError)).toBeTruthy();
    expect(EpsilonHttpError.errorIs50x(testError)).toBeFalsy();
    expect(EpsilonHttpError.errorIs40x(nonHttpError)).toBeFalsy();
    expect(EpsilonHttpError.errorIs50x(testError)).toBeFalsy();
  });
});
