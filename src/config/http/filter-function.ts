import { FilterChainContext } from './filter-chain-context';

export interface FilterFunction {
  (fCtx: FilterChainContext): Promise<boolean>;
}
