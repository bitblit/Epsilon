import { EpsilonConfig } from './epsilon-config';
import { WebHandler } from '../http/web-handler';
import { SaltMineHandler } from '../salt-mine/salt-mine-handler';
import { EpsilonRouter } from '../http/route/epsilon-router';
import { SaltMineQueueManager } from '../salt-mine/salt-mine-queue-manager';
import { SaltMineEntryValidator } from '../salt-mine/salt-mine-entry-validator';
import { OpenApiDocument } from './open-api/open-api-document';
import { ModelValidator } from './model-validator';

export interface EpsilonInstance {
  config: EpsilonConfig;
  parsedOpenApiDoc: OpenApiDocument;
  modelValidator: ModelValidator;
  webHandler: WebHandler;
  saltMineHandler: SaltMineHandler;
  epsilonRouter: EpsilonRouter;
  backgroundManager: SaltMineQueueManager;
  backgroundEntryValidator: SaltMineEntryValidator;
}
