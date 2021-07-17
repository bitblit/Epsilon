import { ExtendedAPIGatewayEvent } from './extended-api-gateway-event';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { EpsilonRouter } from './epsilon-router';
import { APIGatewayEvent, Context } from 'aws-lambda';
import { NumberRatchet } from '@bitblit/ratchet/dist/common/number-ratchet';
import { EpsilonHttpError } from '../error/epsilon-http-error';
import { BadRequestError } from '../error/bad-request-error';

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

    const errNumber: number = NumberRatchet.safeNumber(evt.queryStringParameters['error']);
    if (errNumber) {
      switch (errNumber) {
        case -1:
          throw new Error('Test random failure');
        case 400:
          throw new BadRequestError('Bad request error');
        default:
          throw new EpsilonHttpError<any>()
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
