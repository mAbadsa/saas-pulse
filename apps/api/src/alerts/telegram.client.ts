import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class TelegramError extends Error {}

export interface TelegramUpdate {
  update_id: number;
  message?: { text?: string; chat: { id: number } };
}

interface TelegramReply<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

const TIMEOUT_MS = 5_000;
const LONG_POLL_SECONDS = 25;

/**
 * Minimal Bot API client over fetch. The token is part of every request URL,
 * so URLs are never logged or included in errors.
 */
@Injectable()
export class TelegramClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private username?: string;

  constructor(config: ConfigService) {
    this.token = config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
    this.baseUrl = config.get<string>(
      'TELEGRAM_API_URL',
      'https://api.telegram.org',
    );
  }

  get available(): boolean {
    return this.token.length > 0;
  }

  async getBotUsername(): Promise<string> {
    this.username ??= (
      await this.call<{ username: string }>('getMe', {})
    ).username;
    return this.username;
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    await this.call('sendMessage', { chat_id: chatId, text });
  }

  getUpdates(offset: number, signal: AbortSignal): Promise<TelegramUpdate[]> {
    return this.call<TelegramUpdate[]>(
      'getUpdates',
      { offset, timeout: LONG_POLL_SECONDS, allowed_updates: ['message'] },
      AbortSignal.any([
        signal,
        AbortSignal.timeout((LONG_POLL_SECONDS + 5) * 1000),
      ]),
    );
  }

  private async call<T>(
    method: string,
    body: object,
    signal: AbortSignal = AbortSignal.timeout(TIMEOUT_MS),
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      // Network errors from fetch don't contain the URL, but keep it generic anyway.
      throw new TelegramError(
        `Telegram unreachable (${(e as Error).name === 'TimeoutError' ? 'timeout' : 'network error'})`,
      );
    }
    const data = (await res.json().catch(() => ({
      ok: false,
    }))) as TelegramReply<T>;
    if (!data.ok) {
      throw new TelegramError(
        data.description ?? `Telegram error ${res.status}`,
      );
    }
    return data.result as T;
  }
}
