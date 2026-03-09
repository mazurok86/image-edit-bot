import type { RedisService } from '../services/redisService.js'
import { ChatStore } from './chatStore.js'

export class ChatRegistry {
  private readonly stores = new Map<number, Promise<ChatStore>>()

  constructor(private readonly redisService: RedisService) {}

  private async create(chatId: number): Promise<ChatStore> {
    const created = new ChatStore(chatId, this.redisService)
    await created.load()
    return created
  }

  get(chatId: number): Promise<ChatStore> {
    const existing = this.stores.get(chatId)
    if (existing !== undefined) {
      return existing
    }

    const promise = this.create(chatId)
    this.stores.set(chatId, promise)
    return promise
  }
}
