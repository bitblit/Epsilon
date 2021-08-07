import { EpsilonConfig } from './epsilon-config';
import { WebHandler } from '../http/web-handler';
import { BackgroundHandler } from '../background/background-handler';
import { OpenApiDocument } from './open-api/open-api-document';
import { ModelValidator } from '@bitblit/ratchet/dist/model-validator';
import { BackgroundManager } from '../background-manager';

export interface EpsilonInstance {
  config: EpsilonConfig;
  parsedOpenApiDoc: OpenApiDocument;
  modelValidator: ModelValidator;
  webHandler: WebHandler;
  backgroundHandler: BackgroundHandler;
  backgroundManager: BackgroundManager;
}
