import type { BotContext } from '../botContext.js'
import type { ChatStore } from '../../state/chatStore.js'

export abstract class Handler {
  constructor(protected readonly ctx: BotContext) {}

  protected getChat(chatId: number): ChatStore {
    return this.ctx.store.get(chatId)
  }
}
