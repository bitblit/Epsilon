import { SimpleHttpError } from './simple-http-error';

export class RequestTimeoutError extends SimpleHttpError {
  public static readonly HTTP_CODE: number = 500;

  constructor(...messages: string[]) {
    super(RequestTimeoutError.HTTP_CODE, ...messages);
  }
}
