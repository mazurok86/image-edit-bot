import TelegramBot from 'node-telegram-bot-api'
import type { Message, Document, PhotoSize, Video, KeyboardButton } from 'node-telegram-bot-api'
import { buffer } from 'node:stream/consumers'
import convert from 'heic-convert'

import { ChatStore } from '../state/chatStore.js'
import { FileType } from '../types/fileType.js'
import { BOT_MODELS } from '../models/index.js'
import { isAllowedImage, isAllowedVideo } from '../helpers/fileHelpers.js'
import { ReplicateService } from './replicateService.js'
import type { BotModel } from '../models/index.js'
import type { FileOutput } from '../types/fileOutput.js'
import type { ChatState } from '../types/chatState.js'
import { BOT_TEXTS } from '../constants/botTexts.js'
import { escapeMarkdownV2 } from '../helpers/stringHelpers.js'

export class BotService {
  private bot: TelegramBot
  private store: ChatStore
  private replicateService: ReplicateService
  private allowedChatIds: number[]
  private modelMap: Map<BotModel, (chat: ChatState) => Promise<FileOutput[]>>

  constructor(
    bot: TelegramBot,
    store: ChatStore,
    replicateService: ReplicateService,
    allowedChatIds: number[]
  ) {
    this.allowedChatIds = allowedChatIds
    this.bot = bot
    this.store = store
    this.replicateService = replicateService

    this.modelMap = new Map<BotModel, (chat: ChatState) => Promise<FileOutput[]>>([
      [BOT_MODELS.FLUX, async (chat: ChatState): Promise<FileOutput[]> => {
        return await this.replicateService.runFlux(chat.prompt, chat.images[chat.images.length - 1], 'match_input_image')
      }],
      [BOT_MODELS.FLUX_9_16, async (chat: ChatState): Promise<FileOutput[]> => {
        return await this.replicateService.runFlux(chat.prompt, chat.images[chat.images.length - 1], '9:16')
      }],
      [BOT_MODELS.SEEDREAM, async (chat: ChatState): Promise<FileOutput[]> => {
        return await this.replicateService.runSeedream4(chat.prompt, chat.images, '4:3')
      }],
      [BOT_MODELS.SEEDREAM_9_16, async (chat: ChatState): Promise<FileOutput[]> => {
        return await this.replicateService.runSeedream4(chat.prompt, chat.images, '9:16')
      }],
      [BOT_MODELS.KLING, async (chat: ChatState): Promise<FileOutput[]> => {
        return await this.replicateService.runKling(chat.prompt, chat.images[chat.images.length - 1])
      }],
      [BOT_MODELS.KLING_MC, async (chat: ChatState): Promise<FileOutput[]> => {
        return await this.replicateService.runKlingMotionControl(
          chat.prompt,
          chat.images[chat.images.length - 1],
          chat.videos[chat.videos.length - 1]
        )
      }]
    ])
  }

  public start(): void {
    console.log('Bot running...')
    this.bot.on('message', (msg: Message) => this.handleMessage(msg))
  }

  private async sendMessage(chatId: number, text: string, options?: TelegramBot.SendMessageOptions): Promise<TelegramBot.Message> {
    return await this.bot.sendMessage(chatId, text, { ...options, parse_mode: 'MarkdownV2' })
  }

  private async handleMessage(msg: Message): Promise<void> {
    const chatId = msg.chat.id

    if (!this.allowedChatIds.includes(chatId)) {
      await this.sendMessage(chatId, BOT_TEXTS.BYE)
      return
    }

    const { text, caption, document, photo, video } = msg
    const chat = this.store.get(chatId)

    if (text === BOT_TEXTS.START) {
      await this.sendMessage(chatId, BOT_TEXTS.GREETING)
      return
    }

    if (text === BOT_TEXTS.CLEAR) {
      this.store.clear(chatId)
      await this.sendMessage(chatId, BOT_TEXTS.FILES_CLEARED)
      this.schedulePrompt(chatId)
      return
    }

    if (Object.values(BOT_MODELS).includes(text as BotModel)) {
      await this.generate(chatId, text as BotModel)
      return
    }

    if (document) {
      await this.handleDocument(chatId, document)
      return
    }

    if (photo) {
      await this.handlePhoto(chatId, photo)
      return
    }

    if (video) {
      await this.handleVideo(chatId, video)
      return
    }

    if (chat.images.length === 0 && chat.videos.length === 0) {
      await this.sendMessage(chatId, BOT_TEXTS.NO_FILES)
      return
    }

    const prompt = text === undefined ? (caption === undefined ? '' : caption.trim()) : text.trim()
    if (prompt !== '') {
        chat.prompt = prompt
    }

    this.schedulePrompt(chatId)
  }

  private async generate(chatId: number, model: BotModel): Promise<void> {
    const ok = await this.checkPrompt(chatId)
    if (!ok) {
      return
    }

    const chat = this.store.get(chatId)
    if (chat.busy) {
      await this.sendMessage(chatId, BOT_TEXTS.BUSY)
      return
    }

    chat.busy = true
    console.log(`[${chatId}] Generation started.`)

    await this.bot.sendChatAction(chatId, 'upload_document')
    const handle = setInterval(() => {
      this.bot.sendChatAction(chatId, 'upload_document').catch(() => {})
    }, 5000)

    try {
      const runner = this.modelMap.get(model)
      if (runner === undefined) {
        await this.sendMessage(chatId, BOT_TEXTS.UNKNOWN_MODEL)
        return
      }

      await this.sendMessage(chatId, `${BOT_TEXTS.USING_MODEL}${escapeMarkdownV2(model)}`)

      const files = await runner(chat)

      for (const { buffer, filename, contentType } of files) {
        await this.bot.sendChatAction(chatId, 'upload_document')
        await this.bot.sendDocument(
          chatId,
          buffer,
          {},
          {
            filename,
            contentType,
          },
        )
      }
    } catch (e) {
      console.log(e)
      await this.sendMessage(chatId, BOT_TEXTS.ERROR)
    } finally {
      console.log(`[${chatId}] Generation finished.`)
      clearInterval(handle)
      chat.busy = false
      this.schedulePrompt(chatId)
    }
  }

  private async checkPrompt(chatId: number): Promise<boolean> {
    const chat = this.store.get(chatId)
    const keyboard: KeyboardButton[][] = []
    let text: string | null = null

    const hasPrompt = chat.prompt !== ''
    const hasImages = chat.images.length > 0
    const hasVideo = chat.videos.length > 0

    if (!hasImages && !hasVideo) {
      text = BOT_TEXTS.FILES_REQUIRED
    } else if ((!hasPrompt && !hasVideo) || (hasVideo && !hasImages)) {
      text = ''
      if (hasImages) {
        text += `${BOT_TEXTS.UPLOADED_IMAGES}${chat.images.length}\n`
      }
      if (hasVideo) {
        text += `${BOT_TEXTS.UPLOADED_VIDEOS}${chat.videos.length}\n`
      }
      if (hasVideo && !hasImages) {
        text += BOT_TEXTS.UPLOAD_IMAGE
      } else {
        text += `\n${BOT_TEXTS.UPLOAD_MORE}`
      }
      keyboard.push([{ text: BOT_TEXTS.CLEAR }])
    }

    if (text !== null) {
      await this.sendMessage(
        chatId,
        text,
        {
          reply_markup: {
            keyboard,
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        },
      )
      return false
    }

    return true
  }

  private schedulePrompt(chatId: number, delay: number = 0): void {
    const chat = this.store.get(chatId)
    if (chat.responseTimeout !== undefined) {
      clearTimeout(chat.responseTimeout)
      chat.responseTimeout = undefined
    }
    chat.responseTimeout = setTimeout(() => {
      this.handlePrompt(chatId).catch(() => {})
    }, delay)
  }

  private async handlePrompt(chatId: number): Promise<void> {
    const ok = await this.checkPrompt(chatId)
    if (!ok) {
      return
    }

    const chat = this.store.get(chatId)
    const hasImages = chat.images.length > 0
    const hasVideo = chat.videos.length > 0
    const keyboard: KeyboardButton[][] = []

    keyboard.push([{ text: BOT_TEXTS.CLEAR }])

    if (hasVideo) {
      keyboard.push([{ text: BOT_MODELS.KLING_MC }])
    } else {
      keyboard.push([{ text: BOT_MODELS.FLUX }, { text: BOT_MODELS.FLUX_9_16 }])
      keyboard.push([{ text: BOT_MODELS.SEEDREAM }, { text: BOT_MODELS.SEEDREAM_9_16 }])
      keyboard.push([{ text: BOT_MODELS.KLING }])
    }

    let text = ''
    if (hasImages) {
      text += `${BOT_TEXTS.UPLOADED_IMAGES}${chat.images.length}\n`
    }
    if (hasVideo) {
      text += `${BOT_TEXTS.UPLOADED_VIDEOS}${chat.videos.length}\n`
    }
    if (hasImages || hasVideo) {
      text += '\n'
    }
    text += BOT_TEXTS.SELECT_MODEL

    await this.sendMessage(
      chatId,
      text,
      {
        reply_markup: {
          keyboard,
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      },
    )
  }

  private async handleDocument(chatId: number, doc: Document): Promise<void> {
    const { mime_type, file_id, file_size } = doc
    try {
      if (mime_type === undefined || file_size === undefined) {
        throw new Error()
      }

      if (!isAllowedImage(mime_type) && !isAllowedVideo(mime_type, file_size)) {
        throw new Error()
      }

      if (mime_type === 'image/heic') {
        const streamBuffer = await buffer(this.bot.getFileStream(file_id))
        const arrayBuffer = streamBuffer.buffer.slice(streamBuffer.byteOffset, streamBuffer.byteOffset + streamBuffer.byteLength)
        const output = await convert({ buffer: arrayBuffer, format: 'JPEG', quality: 1 })

        this.store.addFile(chatId, Buffer.from(output), FileType.Image)
      } else if (isAllowedVideo(mime_type, file_size)) {
        const link = await this.bot.getFileLink(file_id)
        this.store.addFile(chatId, link, FileType.Video)
      } else {
        const link = await this.bot.getFileLink(file_id)
        this.store.addFile(chatId, link, FileType.Image)
      }

      this.schedulePrompt(chatId)
    } catch {
      await this.sendMessage(chatId, BOT_TEXTS.INVALID_FILE)
    }
  }

  private async handlePhoto(chatId: number, photos: PhotoSize[]): Promise<void> {
    try {
      if (!photos.length) {
        throw new Error()
      }

      const photo = photos[photos.length - 1]
      if (photo === undefined) {
        throw new Error()
      }

      const fileLink = await this.bot.getFileLink(photo.file_id)

      this.store.addFile(chatId, fileLink, FileType.Image)
      this.schedulePrompt(chatId, 500)
    } catch {
      await this.sendMessage(chatId, BOT_TEXTS.INVALID_IMAGE)
    }
  }

  private async handleVideo(chatId: number, video: Video): Promise<void> {
    try {
      const { mime_type, file_id, file_size } = video
      if (mime_type === undefined || file_size === undefined) {
        throw new Error()
      }
      if (!isAllowedVideo(mime_type, file_size)) {
        throw new Error()
      }

      const fileLink = await this.bot.getFileLink(file_id)

      this.store.addFile(chatId, fileLink, FileType.Video)
      this.schedulePrompt(chatId, 500)
    } catch {
      await this.sendMessage(chatId, BOT_TEXTS.INVALID_VIDEO)
    }
  }
}
