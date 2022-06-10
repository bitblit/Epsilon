import { EpsilonGlobalHandler } from './epsilon-global-handler';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { EpsilonGlobalHandlerProvider } from './epsilon-global-handler-provider';

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

  private static load<T>(filePath: string, className: string): T {
    // eslint-disable-next-line @typescript-eslint/no-var-frequires
    Logger.info('Searching for %s : %s', filePath, __dirname);
    let rval: T = null;
    const val = require(filePath);
    if (val) {
      Logger.debug('Found %s - pulling object', filePath, Object.keys(val));
      rval = val[className];
    }
    return rval;
  }

  public static async findDynamicImportEpsilonGlobalHandlerProvider(): Promise<EpsilonGlobalHandler> {
    const importPath: string =
      process.env[EpsilonConstants.EPSILON_FINDER_DYNAMIC_IMPORT_PATH_ENV_NAME] ||
      EpsilonConstants.DEFAULT_EPSILON_FINDER_DYNAMIC_IMPORT_PATH;
    const fnName: string =
      process.env[EpsilonConstants.EPSILON_FINDER_FUNCTION_NAME_ENV_NAME] || EpsilonConstants.DEFAULT_EPSILON_FINDER_FUNCTION_NAME;
    Logger.debug('Using epsilon finder dynamic import path : %s / %s', importPath, fnName);

    let provider: EpsilonGlobalHandlerProvider = null;
    try {
      provider = this.load(importPath, fnName);
    } catch (err) {
      Logger.error('Error loading provider : %s / %s : %s', importPath, fnName, err, err);
    }

    return provider ? provider.fetchEpsilonGlobalHandler() : null;
  }
  //producer: () => Promise<EpsilonGlobalHandler>

  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}
}
