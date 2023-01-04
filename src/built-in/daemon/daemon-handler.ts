import { Logger } from '@bitblit/ratchet/common/logger';
import { DaemonProcessState } from '@bitblit/ratchet/aws/daemon/daemon-process-state';
import { DaemonAuthorizerFunction } from './daemon-authorizer-function';
import { DaemonLike } from '@bitblit/ratchet/aws';
import { ExtendedAPIGatewayEvent } from '../../config/http/extended-api-gateway-event';
import { NotFoundError } from '../../http/error/not-found-error';
import { DaemonProcessStateList } from './daemon-process-state-list';
import { DaemonGroupSelectionFunction } from './daemon-group-selection-function';
import { DaemonConfig } from './daemon-config';
import { JwtRatchetLike } from '@bitblit/ratchet/common';

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

  // If you are going to map this function, be sure that your Daemon is setup with a JwtRatchet...
  public async fetchDaemonStatusByPublicToken(evt: ExtendedAPIGatewayEvent): Promise<DaemonProcessState> {
    // TODO: verify has access to this key
    const publicToken: string = evt.pathParameters['publicToken'];
    Logger.info('Fetching daemon status for token: %s', publicToken);

    let rval: DaemonProcessState = await this.daemon.statFromPublicToken(publicToken);
    const canRead: boolean = rval ? await this.authorizer(evt, rval) : false;
    rval = canRead ? rval : null;
    if (rval === null) {
      throw new NotFoundError('No such token : ' + publicToken);
    }
    return rval;
  }

  public async fetchDaemonStatus(evt: ExtendedAPIGatewayEvent): Promise<DaemonProcessState> {
    // TODO: verify has access to this key
    const daemonKey: string = evt.pathParameters['key'];
    Logger.info('Fetching daemon status for : %s', daemonKey);

    let rval: DaemonProcessState = await this.daemon.stat(daemonKey);
    const canRead: boolean = rval ? await this.authorizer(evt, rval) : false;
    rval = canRead ? rval : null;
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
