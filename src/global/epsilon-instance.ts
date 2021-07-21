import { EpsilonConfig } from './epsilon-config';
import { WebHandler } from '../http/web-handler';
import { BackgroundHandler } from '../background/background-handler';
import { EpsilonRouter } from '../http/route/epsilon-router';
import { OpenApiDocument } from './open-api/open-api-document';
import { ModelValidator } from '@bitblit/ratchet/dist/model-validator';

export interface EpsilonInstance {
  config: EpsilonConfig;
  parsedOpenApiDoc: OpenApiDocument;
  modelValidator: ModelValidator;
  webHandler: WebHandler;
  backgroundHandler: BackgroundHandler;
  epsilonRouter: EpsilonRouter;
}
