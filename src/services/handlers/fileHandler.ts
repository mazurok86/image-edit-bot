import type { Document, PhotoSize, Video } from 'node-telegram-bot-api'
import { isAllowedImage, isAllowedVideo } from '../../helpers/fileHelpers.js'
import { BOT_TEXTS } from '../../constants/botTexts.js'
import { Handler } from './handler.js'

export class FileHandler extends Handler {
  async handleDocument(chatId: number, doc: Document): Promise<void> {
    const { mime_type, file_id, file_size } = doc
    try {
      if (mime_type === undefined || file_size === undefined) {
        throw new Error()
      }
      if (!isAllowedImage(mime_type) && !isAllowedVideo(mime_type, file_size)) {
        throw new Error()
      }
      const link = await this.ctx.bot.getFileLink(file_id)
      this.getChat(chatId).addFile(link, mime_type)
      console.log(`[${chatId}] File added.`)
      this.ctx.schedulePrompt(chatId)
    } catch {
      console.log(`[${chatId}] Invalid file.`)
      await this.ctx.sendMessage(chatId, BOT_TEXTS.INVALID_FILE)
    }
  }

  async handlePhoto(chatId: number, photos: PhotoSize[]): Promise<void> {
    try {
      if (!photos.length) {
        throw new Error()
      }
      const photo = photos[photos.length - 1]
      if (photo === undefined) {
        throw new Error()
      }
      const fileLink = await this.ctx.bot.getFileLink(photo.file_id)
      this.getChat(chatId).addFile(fileLink, 'image/jpeg')
      console.log(`[${chatId}] Image added.`)
      this.ctx.schedulePrompt(chatId, 500)
    } catch {
      console.log(`[${chatId}] Invalid image.`)
      await this.ctx.sendMessage(chatId, BOT_TEXTS.INVALID_IMAGE)
    }
  }

  async handleVideo(chatId: number, video: Video): Promise<void> {
    try {
      const { mime_type, file_id, file_size } = video
      if (mime_type === undefined || file_size === undefined) {
        throw new Error()
      }
      if (!isAllowedVideo(mime_type, file_size)) {
        throw new Error()
      }
      const fileLink = await this.ctx.bot.getFileLink(file_id)
      this.getChat(chatId).addFile(fileLink, mime_type)
      console.log(`[${chatId}] Video added.`)
      this.ctx.schedulePrompt(chatId, 500)
    } catch {
      console.log(`[${chatId}] Invalid video.`)
      await this.ctx.sendMessage(chatId, BOT_TEXTS.INVALID_VIDEO)
    }
  }
}
