import { ProxyResult } from 'aws-lambda';

export class EpsilonConstants {
  public static readonly DEFAULT_HANDLER_FUNCTION_NAME: string = 'handler';
  public static readonly DEFAULT_CORS_ALLOWED_HEADERS: string = 'Authorization, Origin, X-Requested-With, Content-Type, Range'; // Since safari hates *
  public static readonly DEFAULT_CORS_RESPONSE: ProxyResult = {
    statusCode: 200,
    body: '{"cors":true}',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': EpsilonConstants.DEFAULT_CORS_ALLOWED_HEADERS,
    },
  } as ProxyResult;
  public static readonly AUTH_HEADER_PREFIX: string = 'Bearer ';
  public static readonly AUTH_HEADER_NAME: string = 'Authorization';
  public static readonly AUTH_HEADER_NAME_LOWERCASE: string = 'authorization'; // Since this can vary

  public static readonly CORS_MATCH_REQUEST_FLAG: string = 'MATCH';

  public static readonly SALT_MINE_SQS_TYPE_FIELD = 'SALT_MINE_TYPE';
  public static readonly SALT_MINE_SNS_START_MARKER = 'SALT_MINE_START_MARKER';
  public static readonly SALT_MINE_SNS_IMMEDIATE_RUN_FLAG = 'SALT_MINE_IMMEDIATE_RUN_FLAG';

  // Prevent instantiation
  private constructor() {}
}
