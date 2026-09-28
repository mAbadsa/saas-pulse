import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const PRUNE_EVERY_MS = 60 * 60 * 1000;
// 7-day stats need 7 days of history.
const MIN_RETENTION_DAYS = 7;

/** Deletes checks older than CHECK_RETENTION_DAYS (default 30) hourly. */
@Injectable()
export class CheckRetentionService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(CheckRetentionService.name);
  private readonly enabled: boolean;
  private readonly days: number;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.enabled = config.get('PING_ENABLED') !== 'false';
    const configured = Number(config.get('CHECK_RETENTION_DAYS') ?? 30);
    this.days = Math.max(
      MIN_RETENTION_DAYS,
      Number.isFinite(configured) ? configured : 30,
    );
  }

  onApplicationBootstrap() {
    if (!this.enabled) return;
    void this.prune();
    this.timer = setInterval(() => void this.prune(), PRUNE_EVERY_MS);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /** Returns how many checks were deleted. */
  // ponytail: filters on checkedAt alone (not the index's leading column); add @@index([checkedAt]) or batch deletes if pruning gets slow
  async prune(): Promise<number> {
    try {
      const cutoff = new Date(Date.now() - this.days * 86_400_000);
      const { count } = await this.prisma.check.deleteMany({
        where: { checkedAt: { lt: cutoff } },
      });
      if (count)
        this.logger.log(`Pruned ${count} checks older than ${this.days} days`);
      return count;
    } catch (e) {
      this.logger.error(e);
      return 0;
    }
  }
}
