import { RouteMapping } from './route-mapping';
import { HttpConfig } from './http-config';
import { ModelValidator } from '../../global/model-validator';

export interface EpsilonRouter {
  routes: RouteMapping[];
  openApiModelValidator: ModelValidator; // Must be set to use model validation in your route mappings

  config: HttpConfig;
}
