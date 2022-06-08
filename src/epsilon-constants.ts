import { EpsilonGlobalHandler } from './epsilon-global-handler';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { ErrorRatchet } from '@bitblit/ratchet/dist/common/error-ratchet';

export class EpsilonConstants {
  private static readonly EPSILON_GLOBAL_HANDLER_PRODUCER_FIELD_NAME = '___epsilonGlobalHandlerProducer';

  public static readonly AUTH_HEADER_PREFIX: string = 'Bearer ';
  public static readonly AUTH_HEADER_NAME: string = 'Authorization';

  public static readonly BACKGROUND_SQS_TYPE_FIELD = 'BACKGROUND_TYPE';
  public static readonly BACKGROUND_SNS_START_MARKER = 'BACKGROUND_START_MARKER';
  public static readonly BACKGROUND_SNS_IMMEDIATE_RUN_FLAG = 'BACKGROUND_IMMEDIATE_RUN_FLAG';

  public static readonly INTER_API_SNS_EVENT = 'EPSILON_INTER_API_EVENT';

  public static applyGloballyAvailableEpsilonGlobalHandlerProducer(producer: () => Promise<EpsilonGlobalHandler>): void {
    if (!global) {
      ErrorRatchet.throwFormattedErr('Cannot set global - global does not exist');
    }
    global[EpsilonConstants.EPSILON_GLOBAL_HANDLER_PRODUCER_FIELD_NAME] = producer;
  }

  public static async findGloballyAvailableEpsilonGlobalHandler(): Promise<EpsilonGlobalHandler> {
    Logger.info('Looking for global epsilon global handler');
    const rval: EpsilonGlobalHandler = global ? global[EpsilonConstants.EPSILON_GLOBAL_HANDLER_PRODUCER_FIELD_NAME] : null;
    Logger.debug('Found %s', rval);
    return rval;
  }

  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}
}
