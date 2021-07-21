import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { EpsilonConfig } from './global/epsilon-config';
import { WebHandler } from './http/web-handler';
import { ErrorRatchet } from '@bitblit/ratchet/dist/common/error-ratchet';
import { BackgroundHandler } from './background/background-handler';
import { EpsilonRouter } from './http/route/epsilon-router';
import { RouterUtil } from './http/route/router-util';
import { EpsilonInstance } from './global/epsilon-instance';
import { MisconfiguredError } from './http/error/misconfigured-error';
import yaml from 'js-yaml';
import { OpenApiDocument } from './global/open-api/open-api-document';
import { BackgroundConfigUtil } from './background/background-config-util';
import { BackgroundManager } from './background/background-manager';
import { ModelValidator } from '@bitblit/ratchet/dist/model-validator';

export class EpsilonConfigParser {
  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor() {}

  public static epsilonConfigToEpsilonInstanceAndBackgroundManager(
    config: EpsilonConfig,
    localMode: boolean
  ): [EpsilonInstance, BackgroundManager] {
    this.validateGlobalConfig(config);
    Logger.info('Creating epsilon : Local mode : %s', localMode);
    const parsed: OpenApiDocument = EpsilonConfigParser.parseOpenApiDocument(config.openApiYamlString);
    const modelValidator: ModelValidator = EpsilonConfigParser.openApiDocToValidator(parsed);
    const backgroundHandler: BackgroundHandler = config.backgroundConfig
      ? new BackgroundHandler(config.backgroundConfig, modelValidator)
      : null;
    const backgroundManager: BackgroundManager = BackgroundConfigUtil.backgroundConfigToBackgroundManager(
      config.backgroundConfig,
      modelValidator,
      localMode
    );

    // TODO: refactor me
    const epsilonRouter: EpsilonRouter = config.httpConfig
      ? RouterUtil.openApiYamlToRouterConfig(config.httpConfig, parsed, modelValidator, backgroundManager)
      : null;
    const webHandler: WebHandler = epsilonRouter ? new WebHandler(epsilonRouter) : null;

    const inst: EpsilonInstance = {
      config: config,
      parsedOpenApiDoc: parsed,
      modelValidator: modelValidator,
      webHandler: webHandler,
      backgroundHandler: backgroundHandler,
      epsilonRouter: epsilonRouter,
    };

    return [inst, backgroundManager];
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
      rval = ModelValidator.createFromParsedObject(doc);
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
