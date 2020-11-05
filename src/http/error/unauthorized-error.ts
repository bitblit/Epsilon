import { EpsilonHttpError } from './epsilon-http-error';

export class UnauthorizedError<T = void> extends EpsilonHttpError<T> {
  public static readonly HTTP_CODE: number = 401;

  constructor(...errors: string[]) {
    super(...errors);
    this.withHttpStatusCode(UnauthorizedError.HTTP_CODE);
  }
}
