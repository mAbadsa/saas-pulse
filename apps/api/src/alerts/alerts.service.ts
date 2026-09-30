import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { TelegramLinkResponse, TelegramStatus } from '@saas-pulse/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LinkCodes } from './link-codes';
import { downMessage, recoveredMessage, TEST_TEXT } from './messages';
import { TelegramClient, TelegramError } from './telegram.client';

/** Consecutive failed checks before a down alert (filters out one-off blips). */
const ALERT_AFTER_FAILURES = 2;

const TELEGRAM = 'TELEGRAM' as const;

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private readonly codes = new LinkCodes();

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramClient,
  ) {}

  // ---- Channel management (per user) ----

  async status(userId: string): Promise<TelegramStatus> {
    const channel = await this.findChannel(userId);
    return {
      available: this.telegram.available,
      connected: channel !== null,
      enabled: channel?.enabled ?? false,
      connectedAt: channel?.createdAt.toISOString() ?? null,
    };
  }

  async createLink(userId: string): Promise<TelegramLinkResponse> {
    this.assertAvailable();
    let username: string;
    try {
      username = await this.telegram.getBotUsername();
    } catch (e) {
      throw new BadGatewayException((e as Error).message);
    }
    const { code, expiresAt } = this.codes.issue(userId);
    return {
      url: `https://t.me/${username}?start=${code}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /** Redeem a /start code from Telegram. Returns whether it linked an account. */
  async connect(code: string, chatId: string): Promise<boolean> {
    const userId = this.codes.redeem(code);
    if (!userId) return false;
    await this.prisma.alertChannel.upsert({
      where: { userId_type: { userId, type: TELEGRAM } },
      create: { userId, type: TELEGRAM, target: chatId },
      // Re-linking starts a fresh connection (new chat, enabled, new connectedAt).
      update: { target: chatId, enabled: true, createdAt: new Date() },
    });
    return true;
  }

  async setEnabled(userId: string, enabled: boolean): Promise<TelegramStatus> {
    const { count } = await this.prisma.alertChannel.updateMany({
      where: { userId, type: TELEGRAM },
      data: { enabled },
    });
    if (count === 0) throw new NotFoundException('Telegram is not connected');
    return this.status(userId);
  }

  async disconnect(userId: string): Promise<void> {
    const { count } = await this.prisma.alertChannel.deleteMany({
      where: { userId, type: TELEGRAM },
    });
    if (count === 0) throw new NotFoundException('Telegram is not connected');
  }

  async sendTest(userId: string): Promise<void> {
    this.assertAvailable();
    const channel = await this.findChannel(userId);
    if (!channel) throw new NotFoundException('Telegram is not connected');
    try {
      await this.telegram.sendMessage(channel.target, TEST_TEXT);
    } catch (e) {
      throw new BadGatewayException((e as Error).message);
    }
  }

  // ---- Incident state machine (called by the ping service) ----

  /**
   * Called after every saved check. State lives in Monitor.alertDownSince; each
   * transition is a guarded updateMany, so concurrent evaluations can't both send.
   * Delivery is fire-and-forget: Telegram can never slow down or fail checks.
   */
  async onCheckRecorded(monitorId: string, isUp: boolean): Promise<void> {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id: monitorId },
      select: { name: true, url: true, userId: true, alertDownSince: true },
    });
    if (!monitor) return;

    if (isUp) {
      if (!monitor.alertDownSince) return;
      const { count } = await this.prisma.monitor.updateMany({
        where: { id: monitorId, alertDownSince: monitor.alertDownSince },
        data: { alertDownSince: null },
      });
      if (count === 1) {
        this.deliver(
          monitor.userId,
          recoveredMessage({
            name: monitor.name,
            url: monitor.url,
            downForMs: Date.now() - monitor.alertDownSince.getTime(),
          }),
        );
      }
      return;
    }

    if (monitor.alertDownSince) return; // already alerted for this incident
    const recent = await this.prisma.check.findMany({
      where: { monitorId },
      orderBy: { checkedAt: 'desc' },
      take: ALERT_AFTER_FAILURES,
      select: { isUp: true, checkedAt: true, statusCode: true, error: true },
    });
    if (recent.length < ALERT_AFTER_FAILURES || recent.some((c) => c.isUp)) {
      return;
    }
    const since = recent[recent.length - 1].checkedAt;
    const { count } = await this.prisma.monitor.updateMany({
      where: { id: monitorId, alertDownSince: null },
      data: { alertDownSince: since },
    });
    if (count === 1) {
      const latest = recent[0];
      this.deliver(
        monitor.userId,
        downMessage({
          name: monitor.name,
          url: monitor.url,
          reason:
            latest.statusCode !== null
              ? `HTTP ${latest.statusCode}`
              : (latest.error ?? 'Unknown error'),
          since,
        }),
      );
    }
  }

  private deliver(userId: string, text: string): void {
    if (!this.telegram.available) return;
    void (async () => {
      const channel = await this.findChannel(userId);
      if (!channel?.enabled) return;
      await this.telegram.sendMessage(channel.target, text);
    })().catch((e: unknown) =>
      this.logger.warn(
        `Telegram alert not delivered: ${e instanceof TelegramError ? e.message : String(e)}`,
      ),
    );
  }

  private findChannel(userId: string) {
    return this.prisma.alertChannel.findUnique({
      where: { userId_type: { userId, type: TELEGRAM } },
    });
  }

  private assertAvailable() {
    if (!this.telegram.available) {
      throw new ServiceUnavailableException(
        'Telegram alerts are not configured on this server',
      );
    }
  }
}
