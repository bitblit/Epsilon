import { SaltMineEntry } from './salt-mine-entry';
import { Logger } from '@bitblit/ratchet/dist/common';
import { SaltMineProcessor } from './salt-mine-processor';
import { SaltMineConfig } from './salt-mine-config';
import { SaltMineQueueUtil } from './salt-mine-queue-util';
import AWS from 'aws-sdk';
import { GetQueueAttributesResult } from 'aws-sdk/clients/sqs';
import { Substitute } from '@fluffy-spoon/substitute';

describe('#createEntry', function () {
  let mockSqs;
  let mockSns;
  const fakeAccountNumber: string = '123456789012';
  let saltMineConfig: SaltMineConfig;

  beforeEach(() => {
    mockSqs = Substitute.for<AWS.SQS>();
    mockSns = Substitute.for<AWS.SNS>();

    saltMineConfig = {
      processes: {
        a: {},
        b: {},
      },
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

    const queueAttr: GetQueueAttributesResult = await SaltMineQueueUtil.fetchCurrentQueueAttributes(saltMineConfig);
    const msgCount: number = await SaltMineQueueUtil.fetchQueueApproximateNumberOfMessages(saltMineConfig);
    Logger.info('Got : %j', queueAttr);
    Logger.info('Msg: %d', msgCount);
    expect(queueAttr).toBeTruthy();
    expect(msgCount).toEqual(1);
  });

  it('should make sure a processor exists', async () => {
    const processors: Map<string, SaltMineProcessor> = new Map<string, SaltMineProcessor>();
    processors.set(
      'a',
      async (entry: SaltMineEntry): Promise<void> => {
        Logger.info('Called a');
      }
    );
    processors.set(
      'b',
      async (entry: SaltMineEntry): Promise<void> => {
        Logger.info('Called b');
      }
    );

    //const mine: SaltMineHandler = new SaltMineHandler(cfg, processors);

    const resultA = SaltMineQueueUtil.createEntry(saltMineConfig, 'a', {}, {});
    const resultC = SaltMineQueueUtil.createEntry(saltMineConfig, 'c', {}, {});
    expect(resultA.type).toEqual('a');
    expect(resultC).toBeNull();
  });
});
