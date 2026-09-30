import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlertsService } from './alerts.service';
import { CONNECTED_TEXT, EXPIRED_TEXT, HELP_TEXT } from './messages';
import { TelegramClient, type TelegramUpdate } from './telegram.client';

const RETRY_MS = 5_000;

/** Receives /start <code> messages by long polling getUpdates. */
// ponytail: long polling works for a single instance only; switch to setWebhook + a secret-token route for multi-instance
@Injectable()
export class TelegramPoller implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TelegramPoller.name);
  private readonly enabled: boolean;
  private readonly abort = new AbortController();
  private offset = 0;

  constructor(
    private readonly telegram: TelegramClient,
    private readonly alerts: AlertsService,
    config: ConfigService,
  ) {
    // Same background-work gate as the ping loop (e2e tests switch it off).
    this.enabled = telegram.available && config.get('PING_ENABLED') !== 'false';
  }

  onApplicationBootstrap() {
    if (!this.enabled) return;
    this.logger.log('Telegram poller started');
    void this.loop();
  }

  onModuleDestroy() {
    this.abort.abort();
  }

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    const text = update.message?.text?.trim();
    const chatId = update.message?.chat.id;
    if (!text || chatId === undefined) return;

    const code = /^\/start(?:@\w+)?\s+(\S+)$/.exec(text)?.[1];
    let reply = HELP_TEXT;
    if (code) {
      reply = (await this.alerts.connect(code, String(chatId)))
        ? CONNECTED_TEXT
        : EXPIRED_TEXT;
    }
    await this.telegram.sendMessage(String(chatId), reply);
  }

  private async loop(): Promise<void> {
    while (!this.abort.signal.aborted) {
      try {
        const updates = await this.telegram.getUpdates(
          this.offset,
          this.abort.signal,
        );
        for (const update of updates) {
          this.offset = update.update_id + 1;
          await this.handleUpdate(update).catch((e: unknown) =>
            this.logger.warn(`Failed to handle Telegram update: ${String(e)}`),
          );
        }
      } catch (e) {
        if (this.abort.signal.aborted) return;
        this.logger.warn(`Telegram polling failed: ${(e as Error).message}`);
        await new Promise((r) => setTimeout(r, RETRY_MS));
      }
    }
  }
}
