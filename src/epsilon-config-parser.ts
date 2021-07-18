import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { EpsilonConfig } from './global/epsilon-config';
import { WebHandler } from './http/web-handler';
import { ErrorRatchet } from '@bitblit/ratchet/dist/common/error-ratchet';
import { SaltMineHandler } from './salt-mine/salt-mine-handler';
import { EpsilonRouter } from './http/route/epsilon-router';
import { RouterUtil } from './http/route/router-util';
import { EpsilonInstance } from './global/epsilon-instance';
import { MisconfiguredError } from './http/error/misconfigured-error';
import yaml from 'js-yaml';
import { OpenApiDocument } from './global/open-api/open-api-document';
import { SaltMineQueueManager } from './salt-mine/salt-mine-queue-manager';
import { SaltMineEntryValidator } from './salt-mine/salt-mine-entry-validator';
import { LocalSaltMineQueueManager } from './salt-mine/local-salt-mine-queue-manager';
import { RemoteSaltMineQueueManager } from './salt-mine/remote-salt-mine-queue-manager';
import { ModelValidator } from './global/model-validator';
import { HttpConfig } from './http/route/http-config';

export class EpsilonConfigParser {
  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor() {}

  public static epsilonConfigToEpsilonInstance(config: EpsilonConfig, localMode: boolean): EpsilonInstance {
    this.validateGlobalConfig(config);
    Logger.info('Creating epsilon : Local mode : %s', localMode);
    const parsed: OpenApiDocument = EpsilonConfigParser.parseOpenApiDocument(config.openApiYamlString);
    const modelValidator: ModelValidator = EpsilonConfigParser.openApiDocToValidator(parsed);
    const saltMineHandler: SaltMineHandler = config.saltMineConfig ? new SaltMineHandler(config.saltMineConfig, modelValidator) : null;
    const backgroundEntryValidator: SaltMineEntryValidator = saltMineHandler
      ? new SaltMineEntryValidator(config.saltMineConfig, modelValidator)
      : null;

    const backgroundManager: SaltMineQueueManager = localMode
      ? new LocalSaltMineQueueManager(backgroundEntryValidator, saltMineHandler)
      : new RemoteSaltMineQueueManager(config.saltMineConfig.aws, backgroundEntryValidator);

    // TODO: refactor me
    const epsilonRouter: EpsilonRouter = config.httpConfig
      ? RouterUtil.openApiYamlToRouterConfig(config.httpConfig, parsed, modelValidator, backgroundManager)
      : null;
    const webHandler: WebHandler = epsilonRouter ? new WebHandler(epsilonRouter) : null;

    const rval: EpsilonInstance = {
      config: config,
      parsedOpenApiDoc: parsed,
      modelValidator: modelValidator,
      webHandler: webHandler,
      saltMineHandler: saltMineHandler,
      epsilonRouter: epsilonRouter,
      backgroundManager: backgroundManager,
      backgroundEntryValidator: backgroundEntryValidator,
    };

    return rval;
  }

  public static parseOpenApiDocument(yamlString: string): OpenApiDocument {
    if (!yamlString) {
      throw new MisconfiguredError('Cannot configure, missing either yaml or cfg');
    }
    const doc: OpenApiDocument = yaml.load(yamlString) as OpenApiDocument;
    return doc;
  }

  public static openApiDocToValidator(doc: OpenApiDocument): ModelValidator {
    let rval: ModelValidator = null;
    if (doc?.components?.schemas) {
      rval = ModelValidator.createFromParsedOpenApiObject(doc);
    }
    return rval;
  }

  public static validateGlobalConfig(config: EpsilonConfig) {
    if (!config) {
      ErrorRatchet.throwFormattedErr('Config may not be null');
    }
    if (!config.openApiYamlString) {
      ErrorRatchet.throwFormattedErr('Config must define an open api document');
    }
    if (!!config.cron && !config.cron.timezone) {
      ErrorRatchet.throwFormattedErr('Cron is defined, but timezone is not set');
    }
  }
}
