import { EpsilonHttpError } from './epsilon-http-error';

export class ForbiddenError<T = void> extends EpsilonHttpError<T> {
  public static readonly HTTP_CODE: number = 403;

  constructor(...errors: string[]) {
    super(...errors);
    this.withHttpStatusCode(ForbiddenError.HTTP_CODE);
  }
}
