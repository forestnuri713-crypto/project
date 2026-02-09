import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly logger = new Logger(RedisService.name);

  private readonly RELEASE_LOCK_SCRIPT = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl);

    this.redis.on('connect', () => this.logger.log('Redis connected'));
    this.redis.on('error', (err) => this.logger.error('Redis error', err));
  }

  async acquireLock(key: string, ttlMs: number): Promise<string | null> {
    const lockValue = randomUUID();
    const result = await this.redis.set(key, lockValue, 'PX', ttlMs, 'NX');
    return result === 'OK' ? lockValue : null;
  }

  async releaseLock(key: string, lockValue: string): Promise<boolean> {
    const result = await this.redis.eval(this.RELEASE_LOCK_SCRIPT, 1, key, lockValue);
    return result === 1;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.redis.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async sAdd(key: string, ...members: string[]): Promise<number> {
    return this.redis.sadd(key, ...members);
  }

  async sIsMember(key: string, member: string): Promise<boolean> {
    const result = await this.redis.sismember(key, member);
    return result === 1;
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.redis.expire(key, seconds);
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
