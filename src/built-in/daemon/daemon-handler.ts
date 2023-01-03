import { Logger } from '@bitblit/ratchet/common/logger';
import { DaemonProcessState } from '@bitblit/ratchet/aws/daemon/daemon-process-state';
import { DaemonAuthorizerFunction } from './daemon-authorizer-function';
import { DaemonLike } from '@bitblit/ratchet/aws';
import { ExtendedAPIGatewayEvent } from '../../config/http/extended-api-gateway-event';
import { NotFoundError } from '../../http/error/not-found-error';
import { DaemonProcessStateList } from './daemon-process-state-list';
import { DaemonGroupSelectionFunction } from './daemon-group-selection-function';
import { DaemonConfig } from './daemon-config';

/**
 * A helper class to simplify adding Ratchet "Daemon" handling to your application
 */
export class DaemonHandler {
  public static readonly ALLOW_EVERYTHING_AUTHORIZER: DaemonAuthorizerFunction = async (
    evt: ExtendedAPIGatewayEvent,
    proc: DaemonProcessState
  ) => {
    return true;
  };
  private groupSelectionFunction: DaemonGroupSelectionFunction;
  private authorizer: DaemonAuthorizerFunction;

  /**
   * Initialize the Router
   */
  constructor(private daemon: DaemonLike, config?: DaemonConfig) {
    this.authorizer = config?.authorizer || DaemonHandler.ALLOW_EVERYTHING_AUTHORIZER;
    this.groupSelectionFunction = config?.groupSelector || ((evt: ExtendedAPIGatewayEvent) => Promise.resolve(daemon.defaultGroup));
  }

  public async fetchDaemonStatus(evt: ExtendedAPIGatewayEvent): Promise<DaemonProcessState> {
    // TODO: verify has access to this key
    const daemonKey: string = evt.pathParameters['key'];
    Logger.info('Fetching daemon status for : %s', daemonKey);

    const rval: DaemonProcessState = await this.daemon.stat(daemonKey);
    if (rval === null) {
      throw new NotFoundError('No such key : ' + daemonKey);
    }
    return rval;
  }

  public async listDaemonStatus(evt: ExtendedAPIGatewayEvent): Promise<DaemonProcessStateList> {
    const group: string = await this.groupSelectionFunction(evt);
    let keys: DaemonProcessState[] = await this.daemon.list(group);
    const allowed: DaemonProcessState[] = [];
    for (let i = 0; i < keys.length; i++) {
      const canRead: boolean = await this.authorizer(evt, keys[i]);
      if (canRead) {
        allowed.push(keys[i]);
      }
    }
    // Token here for future expansion into pagination, not implemented yet
    const rval: DaemonProcessStateList = {
      results: allowed,
      nextToken: null,
    };
    return rval;
  }
}
