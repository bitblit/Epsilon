import { GoogleWebTokenManipulator } from './google-web-token-manipulator';
import { CommonJwtToken } from '@bitblit/ratchet/common/common-jwt-token';

describe('#googleWebTokenManipulator', function () {
  xit('should extract a token', async () => {
    const token: string = 'TOKEN_HERE';
    const clientId: string = 'CLIENT_HERE';

    const svc: GoogleWebTokenManipulator = new GoogleWebTokenManipulator(clientId);
    const res: CommonJwtToken<any> = await svc.parseAndValidateGoogleToken<any>(token, false);

    expect(res).toBeTruthy();
  });
});
