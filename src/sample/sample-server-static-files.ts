export class SampleServerStaticFiles {
  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static readonly SAMPLE_OPEN_API_DOC: string =
    'openapi: 3.0.0\n' +
    'info:\n' +
    '  version: v0\n' +
    '  title: SampleAPI\n' +
    'tags:\n' +
    '  - name: CORS\n' +
    '    description: These endpoints are here to support CORS\n' +
    '  - name: Public\n' +
    '    description: These endpoints can be called without setting the authorization header\n' +
    '  - name: Secure\n' +
    '    description: Authentication and authorization of the API\n' +
    'paths:\n' +
    '  /:\n' +
    '    get:\n' +
    '      description: Redirects to the /meta/server endpoint\n' +
    '      tags:\n' +
    '        - Meta\n' +
    '        - Public\n' +
    '      responses:\n' +
    "        '301':\n" +
    '          description: Redirects to the /meta/server endpoint\n' +
    '    options:\n' +
    '      tags:\n' +
    '        - CORS\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Standard CORS header response\n' +
    '  /event:\n' +
    '    get:\n' +
    '      description: Tests URL parsing and returns event as JSON\n' +
    '      tags:\n' +
    '        - Meta\n' +
    '        - Public\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: The parsed event, as JSON\n' +
    '    options:\n' +
    '      tags:\n' +
    '        - CORS\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Standard CORS header response\n' +
    '  /meta/server:\n' +
    '    get:\n' +
    '      description: >\n' +
    '        Returns information about the current build and time.  Can be used to\n' +
    '        test error-handling code by passing a specific http error code in the\n' +
    '        error query parameter.  Can also be used to process specific named tests\n' +
    '        by passing those names to the test parameter.\n' +
    '      tags:\n' +
    '        - Public\n' +
    '      parameters:\n' +
    '        - name: error\n' +
    '          in: query\n' +
    '          description: >-\n' +
    '            If set, throw a specific error for testing (valid are\n' +
    '            500,400,403,404)\n' +
    '          required: false\n' +
    '          schema:\n' +
    '            type: number\n' +
    '        - name: test\n' +
    '          in: query\n' +
    '          description: Run a specific named test (currently none are publicly available)\n' +
    '          required: false\n' +
    '          schema:\n' +
    '            type: string\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Success\n' +
    "        '400':\n" +
    '          description: Simulated bad request\n' +
    '          content:\n' +
    "            '*/*':\n" +
    '              schema:\n' +
    "                $ref: '#/components/schemas/ApiErrorResponse'\n" +
    "        '403':\n" +
    '          description: Simulated unauthorized\n' +
    '          content:\n' +
    "            '*/*':\n" +
    '              schema:\n' +
    "                $ref: '#/components/schemas/ApiErrorResponse'\n" +
    "        '404':\n" +
    '          description: Simulated not found\n' +
    '          content:\n' +
    "            '*/*':\n" +
    '              schema:\n' +
    "                $ref: '#/components/schemas/ApiErrorResponse'\n" +
    "        '500':\n" +
    '          description: Simulated internal server error\n' +
    '          content:\n' +
    "            '*/*':\n" +
    '              schema:\n' +
    "                $ref: '#/components/schemas/ApiErrorResponse'\n" +
    '    options:\n' +
    '      tags:\n' +
    '        - CORS\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Standard CORS header response\n' +
    '  /meta/user:\n' +
    '    get:\n' +
    '      description: >\n' +
    '        When logged in, returns the contents of the JWT token as the server\n' +
    '        parses it.  This should match what you get when you process the token\n' +
    '        returned from the "POST /access-token" endpoint through a standard JWT\n' +
    '        token processor.\n' +
    '      tags:\n' +
    '        - Meta\n' +
    '      security:\n' +
    '        - SampleAuthorizer: []\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Success\n' +
    '          content:\n' +
    "            '*/*':\n" +
    '              schema:\n' +
    "                $ref: '#/components/schemas/AccessTokenContents'\n" +
    "        '401':\n" +
    '          description: Unauthorized\n' +
    '          content:\n' +
    "            '*/*':\n" +
    '              schema:\n' +
    "                $ref: '#/components/schemas/ApiErrorResponse'\n" +
    '    options:\n' +
    '      tags:\n' +
    '        - CORS\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Success\n' +
    "        '401':\n" +
    '          description: Unauthorized\n' +
    '          content:\n' +
    "            '*/*':\n" +
    '              schema:\n' +
    "                $ref: '#/components/schemas/ApiErrorResponse'\n" +
    '  /meta/item/{itemId}:\n' +
    '    get:\n' +
    '      description: >\n' +
    '        Example of a path param\n' +
    '      parameters:\n' +
    '        - name: itemId\n' +
    '          in: path\n' +
    '          description: A sample item id\n' +
    '          required: true\n' +
    '          schema:\n' +
    '            type: string\n' +
    '      tags:\n' +
    '        - Meta\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Success\n' +
    '          content:\n' +
    "            '*/*':\n" +
    '              schema:\n' +
    "                $ref: '#/components/schemas/Empty'\n" +
    "        '401':\n" +
    '          description: Unauthorized\n' +
    '          content:\n' +
    "            '*/*':\n" +
    '              schema:\n' +
    "                $ref: '#/components/schemas/ApiErrorResponse'\n" +
    '    options:\n' +
    '      tags:\n' +
    '        - CORS\n' +
    '      parameters:\n' +
    '        - name: itemId\n' +
    '          in: path\n' +
    '          description: A sample item id\n' +
    '          required: true\n' +
    '          schema:\n' +
    '            type: string\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Success\n' +
    "        '401':\n" +
    '          description: Unauthorized\n' +
    '          content:\n' +
    "            '*/*':\n" +
    '              schema:\n' +
    "                $ref: '#/components/schemas/ApiErrorResponse'\n" +
    '\n' +
    '  /meta/sample-item:\n' +
    '    get:\n' +
    '      description: >\n' +
    '        Example of an object returned\n' +
    '      parameters:\n' +
    '        - name: num\n' +
    '          in: path\n' +
    '          description: Number to return in the number value\n' +
    '          required: false\n' +
    '          schema:\n' +
    '            type: number\n' +
    '      tags:\n' +
    '        - Meta\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Success\n' +
    '          content:\n' +
    "            'application/json':\n" +
    '              schema:\n' +
    "                $ref: '#/components/schemas/BackgroundSampleInputValidatedProcessorData'\n" +
    '    post:\n' +
    '      description: >\n' +
    '        Example of an object posted\n' +
    '      requestBody:\n' +
    '        content:\n' +
    '          application/json:\n' +
    '            schema:\n' +
    "              $ref: '#/components/schemas/BackgroundSampleInputValidatedProcessorData'\n" +
    '        description: Request to refresh the access token or change active user\n' +
    '        required: true\n' +
    '      tags:\n' +
    '        - Meta\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Success\n' +
    '          content:\n' +
    "            'application/json':\n" +
    '              schema:\n' +
    "                $ref: '#/components/schemas/BackgroundSampleInputValidatedProcessorData'\n" +
    '    options:\n' +
    '      tags:\n' +
    '        - CORS\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Success\n' +
    '\n' +
    '  /secure/access-token:\n' +
    '    post:\n' +
    '      tags:\n' +
    '        - Secure\n' +
    '        - Public\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Success\n' +
    '          content:\n' +
    '            application/json:\n' +
    '              schema:\n' +
    "                $ref: '#/components/schemas/AccessTokenResponse'\n" +
    "        '400':\n" +
    '          description: Invalid request\n' +
    '          content:\n' +
    '            application/json:\n' +
    '              schema:\n' +
    "                $ref: '#/components/schemas/ApiErrorResponse'\n" +
    "        '403':\n" +
    '          description: Invalid credentials\n' +
    '          content:\n' +
    '            application/json:\n' +
    '              schema:\n' +
    "                $ref: '#/components/schemas/ApiErrorResponse'\n" +
    '      requestBody:\n' +
    '        content:\n' +
    '          application/json:\n' +
    '            schema:\n' +
    "              $ref: '#/components/schemas/AccessTokenRequest'\n" +
    '        description: Request to refresh the access token or change active user\n' +
    '        required: true\n' +
    '    options:\n' +
    '      tags:\n' +
    '        - CORS\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Standard CORS header response\n' +
    '  /multi/fixed:\n' +
    '    get:\n' +
    '      description: Tests path matching from most specific to least (this is most)\n' +
    '      tags:\n' +
    '        - Public\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Success\n' +
    '    options:\n' +
    '      tags:\n' +
    '        - CORS\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Standard CORS header response\n' +
    '  /multi/{v}:\n' +
    '    get:\n' +
    '      description: Tests path matching from most specific to least (this is least)\n' +
    '      tags:\n' +
    '        - Public\n' +
    '      parameters:\n' +
    '        - name: v\n' +
    '          in: path\n' +
    '          description: A variable\n' +
    '          required: true\n' +
    '          schema:\n' +
    '            type: string\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Success\n' +
    '    options:\n' +
    '      tags:\n' +
    '        - CORS\n' +
    '      parameters:\n' +
    '        - name: v\n' +
    '          in: path\n' +
    '          description: A variable\n' +
    '          required: true\n' +
    '          schema:\n' +
    '            type: string\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Standard CORS header response\n' +
    '\n' +
    '  /err/{code}:\n' +
    '    get:\n' +
    '      description: Tests path matching from most specific to least (this is least)\n' +
    '      tags:\n' +
    '        - Public\n' +
    '      parameters:\n' +
    '        - name: code\n' +
    '          in: path\n' +
    '          description: Error code\n' +
    '          required: true\n' +
    '          schema:\n' +
    '            type: number\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Success\n' +
    '    options:\n' +
    '      tags:\n' +
    '        - CORS\n' +
    '      parameters:\n' +
    '        - name: code\n' +
    '          in: path\n' +
    '          description: A variable\n' +
    '          required: true\n' +
    '          schema:\n' +
    '            type: number\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Standard CORS header response\n' +
    '\n' +
    '  /background:\n' +
    '    post:\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Success\n' +
    '          content:\n' +
    '            application/json:\n' +
    '              schema:\n' +
    "                $ref: '#/components/schemas/BackgroundQueueResponse'\n" +
    "        '400':\n" +
    '          description: Invalid request\n' +
    '          content:\n' +
    '            application/json:\n' +
    '              schema:\n' +
    "                $ref: '#/components/schemas/ApiErrorResponse'\n" +
    "        '403':\n" +
    '          description: Invalid credentials\n' +
    '          content:\n' +
    '            application/json:\n' +
    '              schema:\n' +
    "                $ref: '#/components/schemas/ApiErrorResponse'\n" +
    '      requestBody:\n' +
    '        content:\n' +
    '          application/json:\n' +
    '            schema:\n' +
    "              $ref: '#/components/schemas/Empty'\n" +
    '        description: Content to echo\n' +
    '        required: true\n' +
    '    options:\n' +
    '      tags:\n' +
    '        - CORS\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Standard CORS header response\n' +
    '\n' +
    '  /background/meta:\n' +
    '    get:\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Success\n' +
    '          content:\n' +
    '            application/json:\n' +
    '              schema:\n' +
    "                $ref: '#/components/schemas/BackgroundMetaResponse'\n" +
    "        '400':\n" +
    '          description: Invalid request\n' +
    '          content:\n' +
    '            application/json:\n' +
    '              schema:\n' +
    "                $ref: '#/components/schemas/ApiErrorResponse'\n" +
    "        '403':\n" +
    '          description: Invalid credentials\n' +
    '          content:\n' +
    '            application/json:\n' +
    '              schema:\n' +
    "                $ref: '#/components/schemas/ApiErrorResponse'\n" +
    '    options:\n' +
    '      tags:\n' +
    '        - CORS\n' +
    '      responses:\n' +
    "        '200':\n" +
    '          description: Standard CORS header response\n' +
    '\n' +
    'x-amazon-apigateway-binary-media-types:\n' +
    "  - '*/*'\n" +
    'x-amazon-apigateway-gateway-responses:\n' +
    '  UNAUTHORIZED:\n' +
    '    statusCode: 401\n' +
    '    responseParameters:\n' +
    '      gatewayresponse.header.Access-Control-Allow-Origin: "\'*\'"\n' +
    '    responseTemplates:\n' +
    '      application/json: \'{"errors":["Unauthorized"], "httpStatusCode": 401}\'\n' +
    '  MISSING_AUTHENTICATION_TOKEN:\n' +
    '    statusCode: 404\n' +
    '    responseParameters:\n' +
    '      gatewayresponse.header.Access-Control-Allow-Origin: "\'*\'"\n' +
    '    responseTemplates:\n' +
    '      application/json: \'{"errors":["No such endpoint"], "httpStatusCode": 404}\'\n' +
    '  INTEGRATION_TIMEOUT:\n' +
    '    statusCode: 504\n' +
    '    responseParameters:\n' +
    '      gatewayresponse.header.Access-Control-Allow-Origin: "\'*\'"\n' +
    '    responseTemplates:\n' +
    '      application/json: \'{"errors":["Timeout"], "httpStatusCode": 504}\'\n' +
    '  DEFAULT_5XX:\n' +
    '    statusCode: 500\n' +
    '    responseParameters:\n' +
    '      gatewayresponse.header.Access-Control-Allow-Origin: "\'*\'"\n' +
    '    responseTemplates:\n' +
    '      application/json: \'{"errors":["Internal Server Error"], "httpStatusCode": 500}\'\n' +
    '\n' +
    'servers:\n' +
    "  - url: 'https://api.sample.com/dev'\n" +
    'components:\n' +
    '  securitySchemes:\n' +
    '    SampleAuthorizer:\n' +
    '      type: apiKey\n' +
    '      name: Authorization\n' +
    '      in: header\n' +
    '  schemas:\n' +
    '    Empty:\n' +
    '      type: object\n' +
    '      title: Empty Schema\n' +
    '\n' +
    '    AccessTokenRequest:\n' +
    '      type: object\n' +
    '      title: Access Token Request\n' +
    '      required:\n' +
    '        - email\n' +
    '        - password\n' +
    '        - scope\n' +
    '      properties:\n' +
    '        email:\n' +
    '          type: string\n' +
    '          description: Email address of the account to authenticate\n' +
    '          format: email\n' +
    '          minLength: 7\n' +
    '        password:\n' +
    '          type: string\n' +
    '          description: Password of the account to authenticate\n' +
    '          minLength: 6\n' +
    '        scope:\n' +
    '          type: string\n' +
    '          enum:\n' +
    '            - OWNER\n' +
    '            - ADVERTISER\n' +
    '            - GLOBAL\n' +
    '            - RUN_AS_OWNER\n' +
    '            - RUN_AS_ADVERTISER\n' +
    '          description: |\n' +
    '            What style of account to authenticate:\n' +
    '             * `OWNER` - A device owner account\n' +
    '             * `ADVERTISER` - A advertising account\n' +
    '             * `GLOBAL` - Used by Adomni customer service\n' +
    '             * `RUN_AS_OWNER` - Used by Adomni customer service\n' +
    '             * `RUN_AS_ADVERTISER` - Used by Adomni customer service\n' +
    '          default: OWNER\n' +
    '        runAs:\n' +
    '          type: string\n' +
    '          description: Used by Adomni customer service\n' +
    '          format: email\n' +
    '        expirationSeconds:\n' +
    '          type: number\n' +
    '          minimum: 10\n' +
    '          maximum: 3600\n' +
    '          default: 3600\n' +
    '    AccessTokenResponse:\n' +
    '      type: object\n' +
    '      title: Access Token Response\n' +
    '      required:\n' +
    '        - token\n' +
    '        - expires\n' +
    '      properties:\n' +
    '        token:\n' +
    '          type: string\n' +
    '          description: A JWT access token for the API\n' +
    '        expires:\n' +
    '          type: number\n' +
    '          format: int64\n' +
    "          description: 'The time this token will expire, expressed in epoch ms'\n" +
    '    AccessTokenContents:\n' +
    '      type: object\n' +
    '      title: Access Token Contents\n' +
    '      description: The contents of the JWT token\n' +
    '      required:\n' +
    '        - exp\n' +
    '        - iss\n' +
    '        - sub\n' +
    '        - iat\n' +
    '        - user\n' +
    '      properties:\n' +
    '        exp:\n' +
    '          type: number\n' +
    '          description: >-\n' +
    '            Expiration claim - The time this token will expire, expressed in\n' +
    '            epoch ms\n' +
    '        iss:\n' +
    '          type: string\n' +
    '          description: Issuer claim - Who created the token\n' +
    '        sub:\n' +
    '          type: string\n' +
    '          description: Subject claim - The target of the token (typically user email)\n' +
    '        iat:\n' +
    '          type: number\n' +
    '          description: >-\n' +
    '            Issued at claim - The time this token was created, expressed in\n' +
    '            epoch ms\n' +
    '        user:\n' +
    '          type: object\n' +
    '          description: Object describing the user authenticated by this token\n' +
    '    ApiErrorResponse:\n' +
    '      type: object\n' +
    '      title: API Error Response\n' +
    '      required:\n' +
    '        - errors\n' +
    '        - httpStatusCode\n' +
    '      properties:\n' +
    '        errors:\n' +
    '          type: array\n' +
    '          items:\n' +
    '            type: string\n' +
    '          description: List of the errors that occurred\n' +
    '        httpStatusCode:\n' +
    '          type: number\n' +
    '          description: Http status code of this error\n' +
    '        detailCode:\n' +
    '          type: number\n' +
    '          description: Adomni detail status code for this error\n' +
    '    BackgroundQueueResponse:\n' +
    '      type: object\n' +
    '      title: Background Queue Response\n' +
    '      description: When any of the background endpoints are hit, this is what will be returned\n' +
    '      required:\n' +
    '        - resultId\n' +
    '        - success\n' +
    '      properties:\n' +
    '        processHandling:\n' +
    '          type: string\n' +
    "          enum: ['Queued', 'Immediate']\n" +
    '        success:\n' +
    '          type: boolean\n' +
    '        resultId:\n' +
    '          type: string\n' +
    '    BackgroundMetaResponse:\n' +
    '      type: object\n' +
    '      title: Background Meta Response\n' +
    '      description: If\n' +
    '      properties:\n' +
    '        validTypes:\n' +
    '          type: array\n' +
    '          items:\n' +
    '            type: string\n' +
    '        currentQueueLength:\n' +
    '          type: number\n' +
    '\n' +
    '    BackgroundSampleInputValidatedProcessorData:\n' +
    '      type: object\n' +
    '      title: BackgroundSampleInputValidatedProcessorData\n' +
    '      description: This is used for testing the background validator\n' +
    '      required:\n' +
    '        - nameParam\n' +
    '        - numberParam\n' +
    '      properties:\n' +
    '        nameParam:\n' +
    '          type: string\n' +
    '          description: A sample name parameter\n' +
    '          minimum: 0\n' +
    '          maximum: 10\n' +
    '        numberParam:\n' +
    '          type: number\n' +
    '          description: A sample number parameter\n';

  public static readonly SAMPLE_SERVER_GRAPHQL: string =
    'schema {\n' +
    '  query: RootQueryType\n' +
    '}\n' +
    '\n' +
    'type RootQueryType {\n' +
    '  serverMeta: ServerMeta\n' +
    '  forceTimeout: ForceTimeout\n' +
    '}\n' +
    '\n' +
    'type ServerMeta {\n' +
    '  version: String\n' +
    '  serverTime: String\n' +
    '  status: String\n' +
    '}\n' +
    '\n' +
    'type ForceTimeout {\n' +
    '  placeholder: String\n' +
    '}\n';
}
