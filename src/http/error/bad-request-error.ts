import { SimpleHttpError } from './simple-http-error';

export class BadRequestError extends SimpleHttpError {
  public static readonly HTTP_CODE: number = 400;

  constructor(...messages: string[]) {
    super(BadRequestError.HTTP_CODE, ...messages);
  }
}
