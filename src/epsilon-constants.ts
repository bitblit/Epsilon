import { EpsilonGlobalHandler } from './epsilon-global-handler';
import { ErrorRatchet } from '@bitblit/ratchet/dist/common/error-ratchet';
import { Logger } from '@bitblit/ratchet/dist/common/logger';

export class EpsilonConstants {
  public static readonly EPSILON_FINDER_DYNAMIC_IMPORT_PATH_ENV_NAME = 'EPSILON_FINDER_DYNAMIC_IMPORT_PATH';
  public static readonly EPSILON_FINDER_FUNCTION_NAME_ENV_NAME = 'EPSILON_FINDER_FUNCTION_NAME';
  public static readonly DEFAULT_EPSILON_FINDER_DYNAMIC_IMPORT_PATH = 'epsilon-global-handler-provider.js';
  public static readonly DEFAULT_EPSILON_FINDER_FUNCTION_NAME = 'findEpsilonGlobalHandler';

  public static readonly AUTH_HEADER_PREFIX: string = 'Bearer ';
  public static readonly AUTH_HEADER_NAME: string = 'Authorization';

  public static readonly BACKGROUND_SQS_TYPE_FIELD = 'BACKGROUND_TYPE';
  public static readonly BACKGROUND_SNS_START_MARKER = 'BACKGROUND_START_MARKER';
  public static readonly BACKGROUND_SNS_IMMEDIATE_RUN_FLAG = 'BACKGROUND_IMMEDIATE_RUN_FLAG';

  public static readonly INTER_API_SNS_EVENT = 'EPSILON_INTER_API_EVENT';

  public static async findDynamicImportEpsilonGlobalHandlerProvider(): Promise<EpsilonGlobalHandler> {
    const importPath: string =
      process.env[EpsilonConstants.EPSILON_FINDER_DYNAMIC_IMPORT_PATH_ENV_NAME] ||
      EpsilonConstants.DEFAULT_EPSILON_FINDER_DYNAMIC_IMPORT_PATH;
    const fnName: string =
      process.env[EpsilonConstants.EPSILON_FINDER_FUNCTION_NAME_ENV_NAME] || EpsilonConstants.DEFAULT_EPSILON_FINDER_FUNCTION_NAME;
    Logger.debug('Using epsilon finder dynamic import path : %s / %s', importPath, fnName);
    const dynImport: any = await import(importPath);
    let producer: Promise<EpsilonGlobalHandler>;
    if (dynImport) {
      const producer: Promise<EpsilonGlobalHandler> = dynImport[fnName]();
      if (!producer) {
        ErrorRatchet.throwFormattedErr('Failed to run producer');
      }
    } else {
      ErrorRatchet.throwFormattedErr('Import with that name not found');
    }
    return producer;
  }
  //producer: () => Promise<EpsilonGlobalHandler>

  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}
}
