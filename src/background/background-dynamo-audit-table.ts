import { BackgroundHandlerListener } from './background-handler-listener';
import { BackgroundHandlerEvent } from './background-handler-event';
import { BackgroundHandlerEventType } from './background-handler-event-type';
import { DynamoRatchet } from '@bitblit/ratchet/dist/aws';
import { ErrorRatchet } from '@bitblit/ratchet/dist/common';
import { ContextUtil } from '../../dist';

export class BackgroundDynamoAuditTable implements BackgroundHandlerListener {
  constructor(private dynamo: DynamoRatchet, private tableName: string, private env: string, private backgroundQueueName: string) {}

  async onEvent(event: BackgroundHandlerEvent): Promise<void> {
    const entry = {
      env: this.env,
      backgroundQueueName: this.backgroundQueueName,
      requestId: ContextUtil.currentRequestId(),
      guid: event.guid,
      processTypeName: event.processorType,
      state: event.type.toString(),
      timestampEpochMs: new Date().getTime(),
    };

    if (event.type == BackgroundHandlerEventType.DataValidationError) {
      const errors: string[] = event.data;
      entry['error'] = errors.join(', ');
    } else if (event.type == BackgroundHandlerEventType.ExecutionFailedError) {
      const error: Error = event.data;
      entry['error'] = ErrorRatchet.safeStringifyErr(error);
    }

    await this.dynamo.simplePut(this.tableName, entry);
  }
}
