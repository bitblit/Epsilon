import { ExtendedAPIGatewayEvent } from '../../config/http/extended-api-gateway-event';

export interface DaemonGroupSelectionFunction {
  (evt: ExtendedAPIGatewayEvent): Promise<string>;
}
