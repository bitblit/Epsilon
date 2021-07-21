import { ExtendedAPIGatewayEvent } from './extended-api-gateway-event';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { EpsilonRouter } from './epsilon-router';
import { APIGatewayEvent, Context } from 'aws-lambda';
import { NumberRatchet } from '@bitblit/ratchet/dist/common/number-ratchet';
import { EpsilonHttpError } from '../error/epsilon-http-error';
import { BadRequestError } from '../error/bad-request-error';
import { BackgroundEntry } from '../../background/background-entry';
import { BooleanRatchet } from '@bitblit/ratchet/dist/common/boolean-ratchet';
import { BackgroundManager } from '../../background/background-manager';

export class BuiltInHandlers {
  public static async handleBackgroundSubmission(evt: ExtendedAPIGatewayEvent, backgroundManager: BackgroundManager): Promise<any> {
    Logger.info('handleBackgroundSubmission : %j', evt.body);

    const parsed: BackgroundEntry = evt.parsedBody;
    const immediate: boolean = BooleanRatchet.parseBool(evt.queryStringParameters['immediate']);
    const startProcessor: boolean = BooleanRatchet.parseBool(evt.queryStringParameters['startProcessor']);

    // We do this manually since the OpenAPI doc will be supplied by the epsilon user
    if (!parsed) {
      throw new BadRequestError('Cannot submit null entry');
    }
    if (!parsed.type) {
      throw new BadRequestError('Cannot submit entry with no type field');
    }
    const errors: string[] = backgroundManager.validateEntry(parsed);
    if (errors.length > 0) {
      throw new EpsilonHttpError<string[]>('Background entry invalid').withDetails(errors).withHttpStatusCode(400);
    }
    let result: string = null;
    if (immediate) {
      result = await backgroundManager.fireImmediateProcessRequest(parsed);
    } else {
      result = await backgroundManager.addEntryToQueue(parsed, startProcessor);
    }

    const rval: any = {
      time: new Date().toLocaleString(),
      path: evt.path,
      message: result,
    };

    return rval;
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
