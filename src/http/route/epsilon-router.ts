import { RouteMapping } from './route-mapping';
import { ModelValidator } from './model-validator';
import { HttpConfig } from './http-config';

export interface EpsilonRouter {
  routes: RouteMapping[];
  openApiModelValidator: ModelValidator; // Must be set to use model validation in your route mappings

  config: HttpConfig;
}
