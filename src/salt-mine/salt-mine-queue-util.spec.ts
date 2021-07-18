import { Logger } from '@bitblit/ratchet/dist/common';
import { SaltMineConfig } from './salt-mine-config';
import { SaltMineQueueManager } from './salt-mine-queue-util';
import AWS from 'aws-sdk';
import { GetQueueAttributesResult } from 'aws-sdk/clients/sqs';
import { Substitute } from '@fluffy-spoon/substitute';
import { EchoProcessor } from './built-in/echo-processor';
import { NoOpProcessor } from './built-in/no-op-processor';
import { SaltMineHandler } from './salt-mine-handler';

describe('#createEntry', function () {
  let mockSqs;
  let mockSns;
  const fakeAccountNumber: string = '123456789012';
  let saltMineConfig: SaltMineConfig;

  const echoProcessor: EchoProcessor = new EchoProcessor();
  const noOpProcessor: NoOpProcessor = new NoOpProcessor();

  beforeEach(() => {
    mockSqs = Substitute.for<AWS.SQS>();
    mockSns = Substitute.for<AWS.SNS>();

    saltMineConfig = {
      processors: [echoProcessor, noOpProcessor],
      aws: {
        sqs: mockSqs,
        sns: mockSns,
        queueUrl: 'https://fake-sqs.fake-availability-zone.test.com/' + fakeAccountNumber + '/fakeQueue.fifo',
        notificationArn: 'arn:aws:sns:fake-availability-zone:' + fakeAccountNumber + ':fakeSnsTopicName',
      },
      development: null,
    };
  });

  it('Should return queue attributes', async () => {
    mockSqs
      .getQueueAttributes({ AttributeNames: ['All'], QueueUrl: saltMineConfig.aws.queueUrl })
      .promise()
      .resolves({ Attributes: { ApproximateNumberOfMessages: 1 } });

    const queueAttr: GetQueueAttributesResult = await SaltMineQueueManager.fetchCurrentQueueAttributes(saltMineConfig);
    const msgCount: number = await SaltMineQueueManager.fetchQueueApproximateNumberOfMessages(saltMineConfig);
    Logger.info('Got : %j', queueAttr);
    Logger.info('Msg: %d', msgCount);
    expect(queueAttr).toBeTruthy();
    expect(msgCount).toEqual(1);
  });

  it('should make sure a processor exists', async () => {
    const mine: SaltMineHandler = new SaltMineHandler(saltMineConfig);

    const resultA = SaltMineQueueManager.createEntry(saltMineConfig, echoProcessor.typeName, {}, {});
    const resultC = SaltMineQueueManager.createEntry(saltMineConfig, 'MissingProcessorXYZ', {}, {});
    expect(resultA.type).toEqual('SaltMineBuiltInEchoProcessor');
    expect(resultC).toBeNull();
  });
});
