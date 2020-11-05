import { EpsilonHttpError } from './epsilon-http-error';

export class TooManyRequestsError<T = void> extends EpsilonHttpError<T> {
  public static readonly HTTP_CODE: number = 429;

  constructor(...errors: string[]) {
    super(...errors);
    this.withHttpStatusCode(TooManyRequestsError.HTTP_CODE);
  }
}
