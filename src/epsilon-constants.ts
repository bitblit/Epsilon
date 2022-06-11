import { EpsilonGlobalHandler } from './epsilon-global-handler';
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

  private static load<T>(filePath: string, className: string): T {
    // eslint-disable-next-line @typescript-eslint/no-var-frequires
    Logger.info('Searching for %s : %s : %s', filePath, className, __dirname);
    let rval: T = null;
    const val = require(filePath);
    if (val) {
      Logger.debug('Found %s - pulling object : %j : %s', filePath, Object.keys(val), className);
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

    let provider: any = null;
    try {
      provider = this.load(importPath, fnName);
    } catch (err) {
      Logger.error('Error loading provider : %s / %s : %s', importPath, fnName, err, err);
    }

    let rval: Promise<EpsilonGlobalHandler> = null;
    if (provider) {
      Logger.debug('Type2 is : %s', typeof provider);
      //const fn = provider.fetchEpsilonGlobalHandler();
      Logger.info('Got3 : %s : %s', provider, typeof provider);
      rval = provider();
      Logger.info('Rval3 is %s', rval);
    }
    return rval;
  }
  //producer: () => Promise<EpsilonGlobalHandler>

  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}
}
