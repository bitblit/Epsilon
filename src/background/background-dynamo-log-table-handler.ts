import { BackgroundHandlerExecutionListener } from './background-handler-execution-listener';
import { BackgroundHandlerExecutionEvent } from './background-handler-execution-event';
import { BackgroundHandlerExecutionEventType } from './background-handler-execution-event-type';
import { DynamoRatchet } from '@bitblit/ratchet/dist/aws';
import { ErrorRatchet } from '@bitblit/ratchet/dist/common';
import { ContextUtil } from '../../dist';
import { BackgroundProcessLogTableEntry } from './background-process-log-table-entry';

export class BackgroundDynamoLogTableHandler implements BackgroundHandlerExecutionListener {
  constructor(private dynamo: DynamoRatchet, private tableName: string, private env: string, private backgroundQueueName: string) {}

  async onEvent(event: BackgroundHandlerExecutionEvent): Promise<void> {
    const entry: BackgroundProcessLogTableEntry = {
      env: this.env,
      backgroundQueueName: this.backgroundQueueName,
      requestId: ContextUtil.currentRequestId(),
      guid: event.guid,
      processTypeName: event.processorType,
      state: event.type.toString(),
      timestampEpochMs: new Date().getTime(),
    };

    if (event.type == BackgroundHandlerExecutionEventType.DataValidationError) {
      const errors: string[] = event.data;
      entry.error = errors.join(', ');
    } else if (event.type == BackgroundHandlerExecutionEventType.ProcessStarting) {
      entry.params = event.data;
    } else if (event.type == BackgroundHandlerExecutionEventType.ExecutionFailedError) {
      const error: Error = event.data;
      entry.error = ErrorRatchet.safeStringifyErr(error);
    }

    await this.dynamo.simplePut(this.tableName, entry);
  }
}
