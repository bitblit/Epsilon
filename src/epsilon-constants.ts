export class EpsilonConstants {
  public static readonly AUTH_HEADER_PREFIX: string = 'Bearer ';
  public static readonly AUTH_HEADER_NAME: string = 'Authorization';

  public static readonly BACKGROUND_SQS_TYPE_FIELD = 'BACKGROUND_TYPE';
  public static readonly BACKGROUND_SNS_START_MARKER = 'BACKGROUND_START_MARKER';
  public static readonly BACKGROUND_SNS_IMMEDIATE_RUN_FLAG = 'BACKGROUND_IMMEDIATE_RUN_FLAG';

  public static readonly INTER_API_SNS_EVENT = 'EPSILON_INTER_API_EVENT';

  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}
}
