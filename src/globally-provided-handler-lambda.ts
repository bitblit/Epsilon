import 'reflect-metadata';
import { Context } from 'aws-lambda';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { EpsilonConstants } from './epsilon-constants';
import { ErrorRatchet } from '@bitblit/ratchet/dist/common/error-ratchet';
import { EpsilonGlobalHandler } from './epsilon-global-handler';

/**
 * Simple bridge for lambda
 * @param event APIGatewayEvent to process
 * @param {Context} context
 */

export const handler = async (event: any, context: Context) => {
  try {
    Logger.debug('Fetching handler from global');
    const producer: Promise<EpsilonGlobalHandler> = EpsilonConstants.findGloballyAvailableEpsilonGlobalHandler();
    const epsilonHandler: EpsilonGlobalHandler = producer ? await producer : null;
    if (!epsilonHandler) {
      ErrorRatchet.throwFormattedErr('Cannot continue - no epsilon handler found.  Producer was %s', producer);
    }
    const result: any = await epsilonHandler.lambdaHandler(event, context);
    return result;
  } catch (err) {
    Logger.error('BAD - failed on create route config with error : %s', err, err);
    throw err;
  }
};
