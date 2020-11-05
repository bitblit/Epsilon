import { ExtendedAPIGatewayEvent } from './extended-api-gateway-event';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { RouterConfig } from './router-config';
import { APIGatewayEvent, Context } from 'aws-lambda';
import { NumberRatchet } from '@bitblit/ratchet/dist/common/number-ratchet';
import { BadRequestError } from '../error/bad-request-error';
import { SimpleHttpError } from '../error/simple-http-error';
import { HttpError } from '../error/http-error';

export class BuiltInHandlers {
  public static async handleNotImplemented(evt: ExtendedAPIGatewayEvent, flag?: string): Promise<any> {
    Logger.info('A request was made to %s with body %j - not yet implemented', evt.path, evt.body);

    const rval: any = {
      time: new Date().toLocaleString(),
      path: evt.path,
      message: 'NOT IMPLEMENTED YET',
    };

    return rval;
  }

  public static async sample(evt: ExtendedAPIGatewayEvent, flag?: string, context?: Context): Promise<any> {
    const rval: any = {
      time: new Date().toLocaleString(),
      evt: evt,
      pad: StringRatchet.createRandomHexString(2000),
      flag: flag,
    };

    if (!!context) {
      rval['context'] = context;
    }

    const err: number = NumberRatchet.safeNumber(evt.queryStringParameters['error']);
    if (err) {
      switch (err) {
        case BadRequestError.HTTP_CODE:
          throw new BadRequestError('Failed test error');
        default:
          throw new SimpleHttpError(500, 'Default error');
      }
    }

    return rval;
  }

  public static async defaultErrorProcessor(event: APIGatewayEvent, err: HttpError, cfg: RouterConfig): Promise<void> {
    Logger.warn(
      'Unhandled error (in promise catch) : %s \nStack was: %s\nEvt was: %j\nConfig was: %j',
      (err.messages || ['Internal Server Error']).join(','),
      err.stack,
      event,
      cfg
    );
  }
}
