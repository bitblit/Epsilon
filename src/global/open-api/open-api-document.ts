import { OpenApiDocumentComponents } from './open-api-document-components';
import { OpenApiDocumentPath } from './open-api-document-path';

export interface OpenApiDocument {
  components: OpenApiDocumentComponents;
  paths: OpenApiDocumentPath[];
}
