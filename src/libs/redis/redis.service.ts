import { Injectable, Logger } from '@nestjs/common';
import { RedisService as NestRedisService } from '@liaoliaots/nestjs-redis';
import type { Redis, ChainableCommander } from 'ioredis';

/**
 * Wrapper generic cho Redis client.
 *
 * Module nghiep vu inject service nay thay vi inject truc tiep
 * RedisService tu @liaoliaots/nestjs-redis.
 */
@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly nestRedisService: NestRedisService) {}

  getClient(): Redis {
    return this.nestRedisService.getOrThrow();
  }

  async get(key: string): Promise<string | null> {
    return this.getClient().get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined) {
      await this.getClient().set(key, value, 'EX', ttlSeconds);
    } else {
      await this.getClient().set(key, value);
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const data = await this.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as T;
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async getOrSetJson<T>(params: { key: string; ttlSeconds: number; loader: () => Promise<T> }): Promise<T> {
    try {
      const cachedValue = await this.get(params.key);

      if (cachedValue !== null) {
        try {
          return JSON.parse(cachedValue) as T;
        } catch (error) {
          this.logger.warn(`Invalid JSON in Redis cache key "${params.key}": ${this.errorMessage(error)}`);
          await this.deleteBestEffort(params.key);
        }
      }
    } catch (error) {
      this.logger.warn(`Redis cache read failed for key "${params.key}": ${this.errorMessage(error)}`);
    }

    const loadedValue = await params.loader();

    if (loadedValue !== null && loadedValue !== undefined) {
      try {
        await this.setJson(params.key, loadedValue, params.ttlSeconds);
      } catch (error) {
        this.logger.warn(`Redis cache write failed for key "${params.key}": ${this.errorMessage(error)}`);
      }
    }

    return loadedValue;
  }

  async deleteBestEffort(...keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    try {
      await this.del(...keys);
    } catch (error) {
      this.logger.warn(`Redis cache invalidation failed for keys "${keys.join(', ')}": ${this.errorMessage(error)}`);
    }
  }

  async incrWithTTL(key: string, ttlSeconds: number): Promise<number> {
    const result = await this.getClient().incr(key);

    if (result === 1) {
      await this.getClient().expire(key, ttlSeconds);
    }

    return result;
  }

  async sadd(key: string, ...values: string[]): Promise<void> {
    if (values.length === 0) return;
    await this.getClient().sadd(key, ...values);
  }

  async srem(key: string, ...values: string[]): Promise<void> {
    if (values.length === 0) return;
    await this.getClient().srem(key, ...values);
  }

  async smembers(key: string): Promise<string[]> {
    return this.getClient().smembers(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.getClient().expire(key, ttlSeconds);
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.getClient().del(...keys);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.getClient().exists(key);
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.getClient().ttl(key);
  }

  pipeline(): ChainableCommander {
    return this.getClient().multi();
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
