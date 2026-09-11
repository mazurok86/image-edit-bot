import path from 'path'
import type { Audio, Document, PhotoSize, Video, Voice } from 'node-telegram-bot-api'
import { isAllowedAudio, isAllowedImage, isAllowedVideo } from '../../helpers/fileHelpers.js'
import { BOT_TEXTS } from '../../constants/botTexts.js'
import { Handler } from './handler.js'
import type { ChatStore } from '../../state/chatStore.js'
import type { FileLocation } from '../../types/fileLocation.js'

export class FileHandler extends Handler {
  private async getFileLocation(fileId: string): Promise<FileLocation> {
    const file = await this.ctx.bot.getFile(fileId)

    const filePath = file.file_path
    if (filePath === undefined) {
      throw new Error('file_path is missing in getFile response')
    }

    const baseApiUrl = process.env.TELEGRAM_BASE_API_URL
    if (baseApiUrl === undefined) {
      throw new Error('Telegram base API URL is missing')
    }

    const token = process.env.TELEGRAM_BOT_TOKEN
    if (token === undefined) {
      throw new Error('Telegram token is missing')
    }

    if (path.isAbsolute(filePath)) {
      const tokenIndex = filePath.indexOf(token)
      if (tokenIndex === -1) {
        throw new Error('Cannot determine relative path for local file')
      }

      const localFileBaseUrl = process.env.TELEGRAM_LOCAL_FILE_BASE_URL
      if (localFileBaseUrl === undefined) {
        throw new Error('Telegram local file base URL is missing')
      }

      const relPath = filePath.slice(tokenIndex + token.length + 1)
      const url = `${localFileBaseUrl}/file/bot${token}/${relPath.replace(/\\/g, '/')}`

      return { type: 'local', path: filePath, url }
    }

    // cloud Telegram
    return { type: 'url', url: `${baseApiUrl}/file/bot${token}/${filePath}` }
  }

  async handleDocument(chat: ChatStore, doc: Document): Promise<void> {
    const { mime_type, file_id, file_size } = doc
    try {
      if (mime_type === undefined || file_size === undefined) {
        throw new Error()
      }
      if (!isAllowedImage(mime_type) && !isAllowedVideo(mime_type, file_size) && !isAllowedAudio(mime_type, file_size)) {
        throw new Error()
      }
      const fileLocation = await this.getFileLocation(file_id)
      chat.addFile(fileLocation.url, mime_type)
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
      const fileLocation = await this.getFileLocation(photo.file_id)
      chat.addFile(fileLocation.url, 'image/jpeg')
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
      const fileLocation = await this.getFileLocation(file_id)
      chat.addFile(fileLocation.url, mime_type)
      console.log(`[${chat.id}] Video added.`)
    } catch {
      console.log(`[${chat.id}] Invalid video.`)
      await this.ctx.sendMessage(chat.id, BOT_TEXTS.INVALID_VIDEO)
    }
  }

  /** Handles both audio messages and voice notes (Telegram sends voice notes as audio/ogg). */
  async handleAudio(chat: ChatStore, audio: Audio | Voice): Promise<void> {
    try {
      const { mime_type, file_id, file_size } = audio
      if (mime_type === undefined || file_size === undefined) {
        throw new Error()
      }
      if (!isAllowedAudio(mime_type, file_size)) {
        throw new Error()
      }
      const fileLocation = await this.getFileLocation(file_id)
      chat.addFile(fileLocation.url, mime_type)
      console.log(`[${chat.id}] Audio added.`)
    } catch {
      console.log(`[${chat.id}] Invalid audio.`)
      await this.ctx.sendMessage(chat.id, BOT_TEXTS.INVALID_AUDIO)
    }
  }
}
