import { EpsilonHttpError } from './epsilon-http-error';

export class NotFoundError<T = void> extends EpsilonHttpError<T> {
  public static readonly HTTP_CODE: number = 404;

  constructor(...errors: string[]) {
    super(...errors);
    this.withHttpStatusCode(NotFoundError.HTTP_CODE);
  }
}
