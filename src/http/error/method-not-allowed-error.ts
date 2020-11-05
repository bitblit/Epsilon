import { EpsilonHttpError } from './epsilon-http-error';

export class MethodNotAllowedError<T = void> extends EpsilonHttpError<T> {
  public static readonly HTTP_CODE: number = 405;

  constructor(...errors: string[]) {
    super(...errors);
    this.withHttpStatusCode(MethodNotAllowedError.HTTP_CODE);
  }
}
