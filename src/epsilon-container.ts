import { EpsilonConfig } from './global/epsilon-config';
import { EpsilonInstance } from './global/epsilon-instance';
import { EpsilonConfigParser } from './epsilon-config-parser';
import { BackgroundManager } from './background/background-manager';
import { Logger } from '@bitblit/ratchet/dist/common/logger';

/**
 * This class functions as the adapter from a default Lambda function to the handlers exposed via Epsilon
 */
export class EpsilonContainer {
  private _epsilonInstance: EpsilonInstance;
  private _backgroundManager: BackgroundManager;
  private _localMode: boolean;

  constructor(private config: EpsilonConfig, localMode?: boolean) {
    [this._epsilonInstance, this._backgroundManager] = EpsilonConfigParser.epsilonConfigToEpsilonInstanceAndBackgroundManager(
      config,
      localMode
    );
    this._localMode = localMode;

    if (this.localMode) {
      Logger.info('Local mode specified - starting background pump');
      this._backgroundManager.localBus().subscribe(async (evt) => {
        Logger.debug('Processing local background entry : %j', evt);
        const rval: boolean = await this._epsilonInstance.backgroundHandler.processSingleBackgroundEntry(evt);
        Logger.info('Processor returned %s', rval);
      });
    } else {
      Logger.info('Using AWS for background');
    }
  }

  public get epsilonInstance(): EpsilonInstance {
    return this._epsilonInstance;
  }

  public get backgroundManager(): BackgroundManager {
    return this._backgroundManager;
  }

  public get localMode(): boolean {
    return this._localMode;
  }
}
