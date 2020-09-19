export interface OpenApiDocModifications {
  newServerPath: string;
  removeEndpoints: RegExp[]; // format is '{verb} {path}'
  removeTags: string[];
  removeSchemas: string[];

  sortEndpoints: boolean;
  sortSchemas: boolean;
}
