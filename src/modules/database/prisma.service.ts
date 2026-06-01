import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const username = encodeURIComponent(process.env.POSTGRES_USER ?? '');
    const password = encodeURIComponent(process.env.POSTGRES_PASSWORD ?? '');
    const database = encodeURIComponent(process.env.POSTGRES_DB ?? '');

    const connectionString = [
      `postgresql://${username}:${password}`,
      `@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}`,
      `/${database}`,
    ].join('');

    const adapter = new PrismaPg({
      connectionString,
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
