import { EpsilonGlobalHandler } from './epsilon-global-handler';

export interface EpsilonGlobalHandlerProvider {
  fetchEpsilonGlobalHandler(): Promise<EpsilonGlobalHandler>;
}
