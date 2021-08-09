import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { FilterChainContext } from '../../config/http/filter-chain-context';

/**
 * This only works because Node is single threaded...
 */
export class LogLevelManipulationFilter {
  private static LOG_LEVEL_BEFORE_CHANGE: string = null;

  // TODO: Implement me!!
  public static async setLogLevelForTransaction(fCtx: FilterChainContext): Promise<boolean> {
    LogLevelManipulationFilter.LOG_LEVEL_BEFORE_CHANGE = Logger.getLevel();
    // TODO: Set me too! Logger.setTracePrefix(null);
    return true;
  }

  public static async clearLogLevelForTransaction(fCtx: FilterChainContext): Promise<boolean> {
    if (LogLevelManipulationFilter.LOG_LEVEL_BEFORE_CHANGE) {
      Logger.setLevelByName(LogLevelManipulationFilter.LOG_LEVEL_BEFORE_CHANGE);
      LogLevelManipulationFilter.LOG_LEVEL_BEFORE_CHANGE = null;
      Logger.setTracePrefix(null);
    }
    return true;
  }
}
