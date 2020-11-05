import { EpsilonHttpError } from './epsilon-http-error';

export class BadRequestError<T = void> extends EpsilonHttpError<T> {
  public static readonly HTTP_CODE: number = 400;

  constructor(...errors: string[]) {
    super(...errors);
    this.withHttpStatusCode(BadRequestError.HTTP_CODE);
  }
}
