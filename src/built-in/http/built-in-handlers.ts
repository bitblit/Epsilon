import { StringRatchet } from '@bitblit/ratchet/common/string-ratchet';
import { Logger } from '@bitblit/ratchet/common/logger';
import { APIGatewayEvent, Context } from 'aws-lambda';
import { NumberRatchet } from '@bitblit/ratchet/common/number-ratchet';
import { ExtendedAPIGatewayEvent } from '../../config/http/extended-api-gateway-event';
import { BadRequestError } from '../../http/error/bad-request-error';
import { EpsilonRouter } from '../../http/route/epsilon-router';
import { UnauthorizedError } from '../../http/error/unauthorized-error';
import { NotFoundError } from '../../http/error/not-found-error';
import { ForbiddenError } from '../../http/error/forbidden-error';
import { NotImplemented } from '../../http/error/not-implemented';
import { MisconfiguredError } from '../../http/error/misconfigured-error';
import { RestfulApiHttpError } from '@bitblit/ratchet/common';

export class BuiltInHandlers {
  public static async expectedHandledByFilter(evt: ExtendedAPIGatewayEvent, flag?: string): Promise<any> {
    throw new MisconfiguredError().withFormattedErrorMessage(
      'Should not happen - it was expected that route %s would be handled by a filter',
      evt.path,
    );
  }

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

    if (context) {
      rval['context'] = context;
    }

    const errNumber: number = NumberRatchet.safeNumber(evt.queryStringParameters['error']);
    if (errNumber) {
      switch (errNumber) {
        case -1:
          throw new Error('Test random failure');
        case 400:
          throw new BadRequestError('Bad request error');
        case 401:
          throw new UnauthorizedError('Unauthorized error');
        case 403:
          throw new ForbiddenError('Forbidden error');
        case 404:
          throw new NotFoundError('Not Found error');
        case 501:
          throw new NotImplemented('Not Implemented');
        default:
          throw new RestfulApiHttpError<any>()
            .withFormattedErrorMessage('Default error - %s', errNumber)
            .withHttpStatusCode(500)
            .withDetails({ src: errNumber })
            .withEndUserErrors(['msg1', 'msg2']);
      }
    }

    let test: string = StringRatchet.trimToNull(evt.queryStringParameters['test']);
    if (test) {
      test = test.toLowerCase();
      if (test === 'null') {
        return null;
      }
    }

    return rval;
  }

  public static async defaultErrorProcessor(event: APIGatewayEvent, err: Error, cfg: EpsilonRouter): Promise<void> {
    Logger.warn('Unhandled error (in promise catch) : %s \nStack was: %s\nEvt was: %j\nConfig was: %j', err.message, err.stack, event, cfg);
  }
}
