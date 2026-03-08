import { ChatStore } from './chatStore.js'

export class ChatRegistry {
  private readonly stores = new Map<number, ChatStore>()

  get(chatId: number): ChatStore {
    const existing = this.stores.get(chatId)
    if (existing !== undefined) {
      return existing
    }
    const created = new ChatStore()
    this.stores.set(chatId, created)
    return created
  }
}
