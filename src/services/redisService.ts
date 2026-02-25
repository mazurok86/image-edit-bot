import { createClient } from 'redis'
import type { RedisClientType } from 'redis'

export class RedisService {
  private client: RedisClientType
  private keyPrefix: string

  constructor(url: string, keyPrefix: string) {
    this.keyPrefix = keyPrefix
    this.client = createClient({ url }) as RedisClientType
  }

  public async connect(): Promise<void> {
    this.client.on('error', (err: unknown) => {
      console.error('Redis error:', err)
      process.exit(1)
    })
    await this.client.connect()
  }

  public async disconnect(): Promise<void> {
    await this.client.quit()
  }

  private k(key: string): string {
    return `${this.keyPrefix}${key}`
  }

  public async get(key: string): Promise<string | null> {
    return this.client.get(this.k(key))
  }

  public async set(key: string, value: string): Promise<void> {
    await this.client.set(this.k(key), value)
  }

  public async setEx(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.client.setEx(this.k(key), ttlSeconds, value)
  }

  public async del(key: string): Promise<void> {
    await this.client.del(this.k(key))
  }

  public async exists(key: string): Promise<boolean> {
    const count = await this.client.exists(this.k(key))
    return count > 0
  }
}
