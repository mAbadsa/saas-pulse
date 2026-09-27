import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { checkUrl, type CheckResult } from './http-check';

const CYCLE_MS = 10_000;
const BATCH_SIZE = 100;
const CONCURRENCY = 10;

@Injectable()
export class PingService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PingService.name);
  private readonly enabled: boolean;
  private readonly allowPrivate: boolean;
  private readonly timeoutMs: number;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.enabled = config.get('PING_ENABLED') !== 'false';
    this.allowPrivate = config.get('PING_ALLOW_PRIVATE') === 'true';
    this.timeoutMs = Number(config.get('PING_TIMEOUT_MS') ?? 10_000);
  }

  onApplicationBootstrap() {
    if (!this.enabled) return;
    if (this.allowPrivate) {
      this.logger.warn(
        'PING_ALLOW_PRIVATE=true: private addresses are NOT blocked',
      );
    }
    this.timer = setInterval(() => void this.runCycle(), CYCLE_MS);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /** Check every due monitor once. Skips if the previous cycle is still running. */
  // ponytail: single-instance loop (in-memory overlap guard, 100/cycle); use a Redis lock or BullMQ for multiple instances or more volume
  async runCycle(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.prisma.$queryRaw<{ id: string; url: string }[]>`
        SELECT id, url FROM "Monitor"
        WHERE "isActive" AND ("lastCheckedAt" IS NULL
           OR "lastCheckedAt" + make_interval(secs => "intervalSeconds") <= now())
        ORDER BY "lastCheckedAt" ASC NULLS FIRST
        LIMIT ${BATCH_SIZE}`;

      for (let i = 0; i < due.length; i += CONCURRENCY) {
        const results = await Promise.allSettled(
          due.slice(i, i + CONCURRENCY).map(async ({ id, url }) => {
            const result = await checkUrl(url, {
              timeoutMs: this.timeoutMs,
              allowPrivate: this.allowPrivate,
            });
            await this.recordResult(id, url, result);
          }),
        );
        for (const r of results) {
          if (r.status === 'rejected') this.logger.error(r.reason);
        }
      }
    } catch (e) {
      this.logger.error(e);
    } finally {
      this.running = false;
    }
  }

  /**
   * Save a result only if the monitor still exists with the URL that was checked;
   * otherwise (deleted, or URL edited mid-check) silently drop it.
   */
  async recordResult(id: string, checkedUrl: string, result: CheckResult) {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.monitor.updateMany({
        where: { id, url: checkedUrl },
        data: { status: result.isUp ? 'UP' : 'DOWN', lastCheckedAt: now },
      });
      if (count === 1) {
        await tx.check.create({
          data: { monitorId: id, checkedAt: now, ...result },
        });
      }
    });
  }
}
