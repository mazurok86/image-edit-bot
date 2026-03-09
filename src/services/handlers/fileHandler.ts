import type { Document, PhotoSize, Video } from 'node-telegram-bot-api'
import { isAllowedImage, isAllowedVideo } from '../../helpers/fileHelpers.js'
import { BOT_TEXTS } from '../../constants/botTexts.js'
import { Handler } from './handler.js'
import type { ChatStore } from '../../state/chatStore.js'

export class FileHandler extends Handler {
  async handleDocument(chat: ChatStore, doc: Document): Promise<void> {
    const { mime_type, file_id, file_size } = doc
    try {
      if (mime_type === undefined || file_size === undefined) {
        throw new Error()
      }
      if (!isAllowedImage(mime_type) && !isAllowedVideo(mime_type, file_size)) {
        throw new Error()
      }
      const link = await this.ctx.bot.getFileLink(file_id)
      chat.addFile(link, mime_type)
      console.log(`[${chat.id}] File added.`)
    } catch {
      console.log(`[${chat.id}] Invalid file.`)
      await this.ctx.sendMessage(chat.id, BOT_TEXTS.INVALID_FILE)
    }
  }

  async handlePhoto(chat: ChatStore, photos: PhotoSize[]): Promise<void> {
    try {
      if (!photos.length) {
        throw new Error()
      }
      const photo = photos[photos.length - 1]
      if (photo === undefined) {
        throw new Error()
      }
      const fileLink = await this.ctx.bot.getFileLink(photo.file_id)
      chat.addFile(fileLink, 'image/jpeg')
      console.log(`[${chat.id}] Image added.`)
    } catch {
      console.log(`[${chat.id}] Invalid image.`)
      await this.ctx.sendMessage(chat.id, BOT_TEXTS.INVALID_IMAGE)
    }
  }

  async handleVideo(chat: ChatStore, video: Video): Promise<void> {
    try {
      const { mime_type, file_id, file_size } = video
      if (mime_type === undefined || file_size === undefined) {
        throw new Error()
      }
      if (!isAllowedVideo(mime_type, file_size)) {
        throw new Error()
      }
      const fileLink = await this.ctx.bot.getFileLink(file_id)
      chat.addFile(fileLink, mime_type)
      console.log(`[${chat.id}] Video added.`)
    } catch {
      console.log(`[${chat.id}] Invalid video.`)
      await this.ctx.sendMessage(chat.id, BOT_TEXTS.INVALID_VIDEO)
    }
  }
}
