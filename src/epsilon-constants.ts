import { EpsilonGlobalHandler } from './epsilon-global-handler';
import { ErrorRatchet } from '@bitblit/ratchet/dist/common/error-ratchet';

export class EpsilonConstants {
  public static readonly DEFAULT_DYNAMIC_IMPORT_GLOBAL_HANDLER_PROVIDER_EXPORT_NAME = 'EpsilonGlobalHandlerProvider';

  public static readonly AUTH_HEADER_PREFIX: string = 'Bearer ';
  public static readonly AUTH_HEADER_NAME: string = 'Authorization';

  public static readonly BACKGROUND_SQS_TYPE_FIELD = 'BACKGROUND_TYPE';
  public static readonly BACKGROUND_SNS_START_MARKER = 'BACKGROUND_START_MARKER';
  public static readonly BACKGROUND_SNS_IMMEDIATE_RUN_FLAG = 'BACKGROUND_IMMEDIATE_RUN_FLAG';

  public static readonly INTER_API_SNS_EVENT = 'EPSILON_INTER_API_EVENT';

  public static async findDynamicImportEpsilonGlobalHandlerProvider(): Promise<EpsilonGlobalHandler> {
    const producer: Promise<EpsilonGlobalHandler> = import(EpsilonConstants.DEFAULT_DYNAMIC_IMPORT_GLOBAL_HANDLER_PROVIDER_EXPORT_NAME);
    if (!producer) {
      ErrorRatchet.throwFormattedErr('Could not find handler with name ');
    }
    return producer;
  }
  //producer: () => Promise<EpsilonGlobalHandler>

  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}
}
