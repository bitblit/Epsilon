import { EpsilonHttpError } from './epsilon-http-error';

export class NotImplemented<T = void> extends EpsilonHttpError<T> {
  public static readonly HTTP_CODE: number = 501;

  constructor(...errors: string[]) {
    super(...errors);
    this.withHttpStatusCode(NotImplemented.HTTP_CODE);
  }
}
