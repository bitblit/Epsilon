import { SimpleHttpError } from './simple-http-error';

export class TooManyRequestsError extends SimpleHttpError {
  public static readonly HTTP_CODE: number = 429;

  constructor(...messages: string[]) {
    super(TooManyRequestsError.HTTP_CODE, ...messages);
  }
}
