import { DaemonAuthorizerFunction } from './daemon-authorizer-function';
import { DaemonGroupSelectionFunction } from './daemon-group-selection-function';

export interface DaemonConfig {
  authorizer?: DaemonAuthorizerFunction;
  groupSelector?: DaemonGroupSelectionFunction;
  fetchDaemonStatusPathParameter?: string;
  fetchDaemonStatusByPublicTokenPathParameter?: string;
}
