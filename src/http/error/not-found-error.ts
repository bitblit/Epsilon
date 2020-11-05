import { SimpleHttpError } from './simple-http-error';

export class NotFoundError extends SimpleHttpError {
  public static readonly HTTP_CODE: number = 404;

  constructor(...messages: string[]) {
    super(NotFoundError.HTTP_CODE, ...messages);
  }
}
