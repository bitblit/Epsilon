import { Logger } from '@bitblit/ratchet/common/logger';
import { ErrorRatchet } from '@bitblit/ratchet/common/error-ratchet';
import yaml from 'js-yaml';
import { ModelValidator } from '@bitblit/ratchet/model-validator';
import { BackgroundHttpAdapterHandler } from '../background/background-http-adapter-handler';
import { OpenApiDocument } from '../config/open-api/open-api-document';
import { EpsilonConfig } from '../config/epsilon-config';
import { EpsilonInstance } from '../epsilon-instance';
import { BackgroundHandler } from '../background/background-handler';
import { EpsilonRouter } from '../http/route/epsilon-router';
import { RouterUtil } from '../http/route/router-util';
import { WebHandler } from '../http/web-handler';
import { MisconfiguredError } from '../http/error/misconfigured-error';
import { BackgroundManager } from '../background-manager';
import { EpsilonGlobalHandler } from '../epsilon-global-handler';

export class EpsilonConfigParser {
  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor() {}

  public static epsilonConfigToEpsilonGlobalHandler(config: EpsilonConfig, backgroundManager?: BackgroundManager): EpsilonGlobalHandler {
    return new EpsilonGlobalHandler(EpsilonConfigParser.epsilonConfigToEpsilonInstance(config, backgroundManager));
  }

  public static epsilonConfigToEpsilonInstance(config: EpsilonConfig, backgroundManager?: BackgroundManager): EpsilonInstance {
    this.validateGlobalConfig(config);
    Logger.info('Creating epsilon : BM : %j', backgroundManager);
    const parsed: OpenApiDocument = EpsilonConfigParser.parseOpenApiDocument(config.openApiYamlString);
    const modelValidator: ModelValidator = EpsilonConfigParser.openApiDocToValidator(parsed);
    const backgroundHttpAdapter: BackgroundHttpAdapterHandler = new BackgroundHttpAdapterHandler(
      config.backgroundConfig,
      modelValidator,
      backgroundManager
    );
    const backgroundHandler: BackgroundHandler = config.backgroundConfig
      ? new BackgroundHandler(config.backgroundConfig, backgroundManager, modelValidator)
      : null;

    // TODO: refactor me
    const epsilonRouter: EpsilonRouter = config.httpConfig
      ? RouterUtil.openApiYamlToRouterConfig(config.httpConfig, parsed, modelValidator, backgroundHttpAdapter)
      : null;
    const webHandler: WebHandler = epsilonRouter ? new WebHandler(epsilonRouter) : null;

    const inst: EpsilonInstance = {
      config: config,
      parsedOpenApiDoc: parsed,
      modelValidator: modelValidator,
      webHandler: webHandler,
      backgroundHandler: backgroundHandler,
      backgroundManager: backgroundManager,
    };

    return inst;
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
      rval = ModelValidator.createFromParsedObject(doc.components.schemas);
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
