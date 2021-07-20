import { Logger } from '@bitblit/ratchet/dist/common';
import { BackgroundConfig } from './background-config';
import AWS from 'aws-sdk';
import { GetQueueAttributesResult } from 'aws-sdk/clients/sqs';
import { Substitute } from '@fluffy-spoon/substitute';
import { EchoProcessor } from './built-in/echo-processor';
import { NoOpProcessor } from './built-in/no-op-processor';
import { BackgroundHandler } from './background-handler';
import { RemoteBackgroundQueueManager } from './remote-background-queue-manager';
import { BackgroundEntryValidator } from './background-entry-validator';
import { ModelValidator } from '../global/model-validator';

describe('#createEntry', function () {
  let mockSqs;
  let mockSns;
  let queueMgr: RemoteBackgroundQueueManager;
  let validator: BackgroundEntryValidator;
  const fakeAccountNumber: string = '123456789012';
  let backgroundConfig: BackgroundConfig;

  const echoProcessor: EchoProcessor = new EchoProcessor();
  const noOpProcessor: NoOpProcessor = new NoOpProcessor();

  beforeEach(() => {
    mockSqs = Substitute.for<AWS.SQS>();
    mockSns = Substitute.for<AWS.SNS>();

    backgroundConfig = {
      processors: [echoProcessor, noOpProcessor],
      aws: {
        sqs: mockSqs,
        sns: mockSns,
        queueUrl: 'https://fake-sqs.fake-availability-zone.test.com/' + fakeAccountNumber + '/fakeQueue.fifo',
        notificationArn: 'arn:aws:sns:fake-availability-zone:' + fakeAccountNumber + ':fakeSnsTopicName',
      },
    };

    validator = new BackgroundEntryValidator(backgroundConfig, {} as ModelValidator);
    queueMgr = new RemoteBackgroundQueueManager(backgroundConfig.aws, validator);
  });

  it('Should return queue attributes', async () => {
    mockSqs
      .getQueueAttributes({ AttributeNames: ['All'], QueueUrl: backgroundConfig.aws.queueUrl })
      .promise()
      .resolves({ Attributes: { ApproximateNumberOfMessages: 1 } });

    const queueAttr: GetQueueAttributesResult = await queueMgr.fetchCurrentQueueAttributes();
    const msgCount: number = await queueMgr.fetchApproximateNumberOfQueueEntries();
    Logger.info('Got : %j', queueAttr);
    Logger.info('Msg: %d', msgCount);
    expect(queueAttr).toBeTruthy();
    expect(msgCount).toEqual(1);
  });

  it('should make sure a processor exists', async () => {
    const mine: BackgroundHandler = new BackgroundHandler(backgroundConfig);

    const resultA = validator.createEntry(echoProcessor.typeName, {}, {});
    const resultC = validator.createEntry('MissingProcessorXYZ', {}, {}, true);
    expect(resultA.type).toEqual('BackgroundBuiltInEchoProcessor');
    expect(resultC).toBeNull();
  });
});
