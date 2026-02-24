import type { ChatState } from '../types/chatState.js'
import type { FileMimeType } from '../types/fileMimeType.js'

export class ChatStore {
  private readonly chats = new Map<number, ChatState>()

  get(chatId: number): ChatState {
    const existing = this.chats.get(chatId)

    if (existing !== undefined) {
      return existing
    }

    const created: ChatState = {
      prompt: '',
      files: [],
      timeout: undefined,
      responseTimeout: undefined,
      busy: false,
    }

    this.chats.set(chatId, created)

    return created
  }

  clear(chatId: number): void {
    const chat = this.chats.get(chatId)
    if (!chat) {
      return
    }

    chat.prompt = ''
    chat.files = []
  }

  addFile(chatId: number, url: string, mimeType: FileMimeType): void {
    const chat = this.get(chatId)

    if (chat.timeout !== undefined) {
      clearTimeout(chat.timeout)
      chat.timeout = undefined
    }

    chat.files.push({
      url,
      mimeType,
    })

    chat.timeout = setTimeout(() => {
      this.clear(chatId)
    }, 3600000)
  }
}
