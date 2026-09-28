import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMonitorDto, UpdateMonitorDto } from './monitors.dto';

// Response fields: never expose userId.
const SELECT = {
  id: true,
  name: true,
  url: true,
  intervalSeconds: true,
  isActive: true,
  status: true,
  lastCheckedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MonitorSelect;

const notFound = () => new NotFoundException('Monitor not found');

/** Every query is scoped by userId: another user's monitor is indistinguishable from a missing one. */
@Injectable()
export class MonitorsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateMonitorDto) {
    return this.prisma.monitor.create({
      data: { ...dto, userId },
      select: SELECT,
    });
  }

  findAll(userId: string) {
    return this.prisma.monitor.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: SELECT,
    });
  }

  findOne(id: string, userId: string) {
    return this.findOwned(id, userId);
  }

  async update(id: string, userId: string, dto: UpdateMonitorDto) {
    const { name, url, intervalSeconds, isActive } = dto;
    if ([name, url, intervalSeconds, isActive].every((v) => v === undefined)) {
      throw new BadRequestException('At least one field must be provided');
    }

    const current = await this.findOwned(id, userId);
    // The last result described the old address, so it no longer applies.
    const urlChanged = url !== undefined && url !== current.url;

    try {
      return await this.prisma.monitor.update({
        where: { id },
        data: {
          name,
          url,
          intervalSeconds,
          isActive,
          ...(urlChanged && {
            status: 'PENDING',
            lastCheckedAt: null,
            alertDownSince: null, // don't send "recovered" for the old address
          }),
        },
        select: SELECT,
      });
    } catch (e) {
      // Deleted between findOwned and update.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw notFound();
      }
      throw e;
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    // Checks are removed by the DB cascade (Check.monitor onDelete: Cascade).
    const { count } = await this.prisma.monitor.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw notFound();
  }

  private async findOwned(id: string, userId: string) {
    const monitor = await this.prisma.monitor.findFirst({
      where: { id, userId },
      select: SELECT,
    });
    if (!monitor) throw notFound();
    return monitor;
  }
}
