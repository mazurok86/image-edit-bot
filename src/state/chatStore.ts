import { FileType } from '../types/fileType.js'
import type { FileType as FileTypeType } from '../types/fileType.js'
import type { ChatState } from '../types/chatState.js'

export class ChatStore {
  private readonly chats = new Map<number, ChatState>()

  get(chatId: number): ChatState {
    const existing = this.chats.get(chatId)

    if (existing !== undefined) {
      return existing
    }

    const created: ChatState = {
      prompt: '',
      images: [],
      videos: [],
      timeout: undefined,
      responseTimeout: undefined,
      busy: false
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
    chat.images = []
    chat.videos = []
  }

  addFile(chatId: number, file: string | Buffer, type: FileTypeType): void {
    const chat = this.get(chatId)

    if (chat.timeout !== undefined) {
      clearTimeout(chat.timeout)
      chat.timeout = undefined
    }

    if (type === FileType.Image) {
      chat.images.push(file)
    } else {
      chat.videos.push(file as string)
    }

    chat.timeout = setTimeout(() => {
      this.clear(chatId)
    }, 3600000)
  }
}
