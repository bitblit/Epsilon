import { SNSEvent } from 'aws-lambda';
import { InterApiUtil } from './inter-api-util';
import { InterApiConfig } from '../config/inter-api/inter-api-config';
import { JestRatchet } from '@bitblit/ratchet/jest';
import { BackgroundManagerLike } from '../background/manager/background-manager-like';
import { SNSClient } from '@aws-sdk/client-sns';
import { SQSClient } from '@aws-sdk/client-sqs';
import { jest } from '@jest/globals';

describe('#interApiUtil', function () {
  let mockSns;
  let mockSqs;
  let mockBgMgr;

  const evt: SNSEvent = {
    Records: [
      {
        EventSource: 'aws:sns',
        EventVersion: '1.0',
        EventSubscriptionArn: 'arn:aws:sns:us-east-1:012345678901:GenericApiEventTopicDev:6efec6a5-1f02-4fc5-b0f7-fa7c013cf8bb',
        Sns: {
          Type: 'Notification',
          MessageId: '205de1e8-7ba6-52f5-b706-b815f442c512',
          TopicArn: 'arn:aws:sns:us-east-1:012345678901:GenericApiEventTopicDev',
          Subject: null,
          Message:
            '{"type":"EPSILON_INTER_API_EVENT","interApiEvent":{"source":"OriginalApi","type":"Sample","data":{"notes":"SOURCE API: OriginalApi","timestampEpochMS":1636011428200}}}',
          Timestamp: '2021-11-04T07:37:08.241Z',
          SignatureVersion: '1',
          Signature: 'LyS2ybM/Epsq5sFqPJd==',
          SigningCertURL: 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-7ff5318490ec183fbaddaa2a969abfda.pem',
          UnsubscribeURL:
            'https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-east-1:012345678901:GenericApiEventTopicDev:6efec6a5-1f02-4fc5-b0f7-fa7c013cf8bb',
          MessageAttributes: {},
        },
      },
    ],
  };

  beforeEach(() => {
    mockSns = JestRatchet.mock<SNSClient>(jest.fn);
    mockSqs = JestRatchet.mock<SQSClient>(jest.fn);
    mockBgMgr = JestRatchet.mock<BackgroundManagerLike>(jest.fn); //new AwsSqsSnsBackgroundManager({} as BackgroundAwsConfig, mockSqs, mockSns);
  });

  it('should translate processes', async () => {
    mockBgMgr.createEntry.mockResolvedValue({ t: 1 });
    mockBgMgr.addEntriesToQueue.mockResolvedValue(['a]']);

    const cfg: InterApiConfig = {
      aws: {
        source: 'test',
        snsArn: 'test',
        localMode: true,
      },
      processMappings: [
        {
          typeRegex: '.*',
          sourceRegex: '.*',
          disabled: false,
          backgroundProcessTypes: ['TESTBG'],
        },
      ],
    };

    const output: string[] = await InterApiUtil.processInterApiEvent(evt, cfg, mockBgMgr);

    expect(output).not.toBeNull();
    expect(output.length).toEqual(1);
  });

  it('should verify that an event is an inter-api even', async () => {
    const res: boolean = InterApiUtil.isInterApiSnsEvent(evt);
    expect(res).toBeTruthy();
  }, 500);
});
