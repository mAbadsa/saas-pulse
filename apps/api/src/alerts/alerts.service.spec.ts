import { AlertsService } from './alerts.service';

describe('AlertsService.sendAlertViaChannel', () => {
  const ok = { success: true };
  const slack = { sendAlert: jest.fn().mockResolvedValue(ok) };
  const discord = { sendAlert: jest.fn().mockResolvedValue(ok) };
  const email = { sendAlert: jest.fn().mockResolvedValue(ok) };
  const service = new AlertsService(
    {} as never,
    {} as never,
    slack as never,
    discord as never,
    email as never,
  );
  const base = { id: 'c1', userId: 'u1', target: null, isActive: true };

  beforeEach(() => jest.clearAllMocks());

  it('routes SLACK to the Slack webhook', async () => {
    const channel = { ...base, type: 'SLACK', webhookUrl: 'https://hooks/s' };
    await expect(
      service.sendAlertViaChannel(channel as never, 'api', 'https://a', 'DOWN'),
    ).resolves.toEqual(ok);
    expect(slack.sendAlert).toHaveBeenCalledWith(
      'https://hooks/s',
      'api',
      'https://a',
      'DOWN',
      undefined,
    );
  });

  it('routes DISCORD and EMAIL to their own services', async () => {
    await service.sendAlertViaChannel(
      { ...base, type: 'DISCORD', webhookUrl: 'https://d' } as never,
      'api',
      'https://a',
      'UP',
    );
    await service.sendAlertViaChannel(
      { ...base, type: 'EMAIL', email: 'me@example.com' } as never,
      'api',
      'https://a',
      'UP',
    );
    expect(discord.sendAlert).toHaveBeenCalledTimes(1);
    expect(email.sendAlert).toHaveBeenCalledWith(
      'me@example.com',
      'api',
      'https://a',
      'UP',
      undefined,
    );
  });

  it('reports a missing target instead of throwing', async () => {
    const channel = { ...base, type: 'SLACK', webhookUrl: null };
    await expect(
      service.sendAlertViaChannel(channel as never, 'api', 'https://a', 'DOWN'),
    ).resolves.toEqual({ success: false, error: 'Unknown delivery service' });
  });

  it('turns a thrown delivery error into a failed result', async () => {
    slack.sendAlert.mockRejectedValueOnce(new Error('boom'));
    const channel = { ...base, type: 'SLACK', webhookUrl: 'https://hooks/s' };
    await expect(
      service.sendAlertViaChannel(channel as never, 'api', 'https://a', 'DOWN'),
    ).resolves.toEqual({ success: false, error: 'boom' });
  });
});
