import { DaemonProcessState } from '@bitblit/ratchet/aws/daemon/daemon-process-state';
import { ExtendedAPIGatewayEvent } from '../../config/http/extended-api-gateway-event';

export interface DaemonAuthorizerFunction {
  (evt: ExtendedAPIGatewayEvent, proc: DaemonProcessState): Promise<boolean>;
}
