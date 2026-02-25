import TelegramBot from 'node-telegram-bot-api'
import type { Message, Document, PhotoSize, Video, KeyboardButton } from 'node-telegram-bot-api'
import { ChatStore } from '../state/chatStore.js'
import { BOT_MODELS } from '../models/index.js'
import { isAllowedImage, isAllowedVideo } from '../helpers/fileHelpers.js'
import { BOT_TEXTS } from '../constants/botTexts.js'
import { escapeMarkdownV2, mapReplicateError } from '../helpers/stringHelpers.js'
import type { ReplicateService } from './replicateService.js'
import type { BotModel } from '../models/index.js'
import type { FileOutput } from '../types/fileOutput.js'
import type { YandexTranslateService } from './yandexTranslateService.js'
import { getChatImages, getChatVideos } from '../helpers/chatHelpers.js'
import type { ChatState } from '../types/chatState.js'
import type { Files } from '../types/files.js'
import { ReplicateApiError } from '../errors/ReplicateApiError.js'

export class BotService {
  private bot: TelegramBot
  private store: ChatStore
  private yandexTranslateService: YandexTranslateService
  private replicateService: ReplicateService
  private allowedChatIds: number[]
  private modelMap: Map<BotModel, (prompt: string, files: Files) => Promise<FileOutput[]>>

  constructor(
    bot: TelegramBot,
    store: ChatStore,
    yandexTranslateService: YandexTranslateService,
    replicateService: ReplicateService,
    allowedChatIds: number[],
  ) {
    this.allowedChatIds = allowedChatIds
    this.bot = bot
    this.store = store
    this.yandexTranslateService = yandexTranslateService
    this.replicateService = replicateService

    this.modelMap = new Map<BotModel, (prompt: string, files: Files) => Promise<FileOutput[]>>([
      [
        BOT_MODELS.FLUX,
        async (prompt: string, files: Files): Promise<FileOutput[]> => {
          return await this.replicateService.runFlux(prompt, files.images[files.images.length - 1], 'match_input_image')
        },
      ],
      [
        BOT_MODELS.FLUX_9_16,
        async (prompt: string, files: Files): Promise<FileOutput[]> => {
          return await this.replicateService.runFlux(prompt, files.images[files.images.length - 1], '9:16')
        },
      ],
      [
        BOT_MODELS.SEEDREAM,
        async (prompt: string, files: Files): Promise<FileOutput[]> => {
          return await this.replicateService.runSeedream4(prompt, files.images, '4:3')
        },
      ],
      [
        BOT_MODELS.SEEDREAM_9_16,
        async (prompt: string, files: Files): Promise<FileOutput[]> => {
          return await this.replicateService.runSeedream4(prompt, files.images, '9:16')
        },
      ],
      [
        BOT_MODELS.NANO_BANANA_PRO,
        async (prompt: string, files: Files): Promise<FileOutput[]> => {
          return await this.replicateService.runNanoBananaPro(prompt, files.images, 'match_input_image')
        },
      ],
      [
        BOT_MODELS.KLING,
        async (prompt: string, files: Files): Promise<FileOutput[]> => {
          return await this.replicateService.runKling(prompt, files.images[files.images.length - 1])
        },
      ],
      [
        BOT_MODELS.KLING_MC,
        async (prompt: string, files: Files): Promise<FileOutput[]> => {
          return await this.replicateService.runKlingMotionControl(
            prompt,
            files.images[files.images.length - 1],
            files.videos[files.videos.length - 1],
          )
        },
      ],
    ])
  }

  public start(): void {
    console.log('Bot running...')
    this.bot.on('message', (msg: Message) => this.handleMessage(msg))
  }

  private async uploadChatFiles(chat: ChatState): Promise<void> {
    for (const file of chat.files) {
      if (file.mimeType === 'image/heic') {
        file.url = await this.replicateService.uploadHeicImage(file.url)
        file.mimeType = 'image/jpeg'
      }
    }
  }

  private async sendMessage(chatId: number, text: string, options?: TelegramBot.SendMessageOptions): Promise<TelegramBot.Message> {
    return await this.bot.sendMessage(chatId, text, {
      ...options,
      parse_mode: 'MarkdownV2',
    })
  }

  private async handleMessage(msg: Message): Promise<void> {
    const chatId = msg.chat.id

    if (!this.allowedChatIds.includes(chatId)) {
      console.log(`[${chatId}] Bye.`)
      await this.sendMessage(chatId, BOT_TEXTS.BYE)
      return
    }

    const { text, caption, document, photo, video } = msg
    const chat = this.store.get(chatId)

    if (text === BOT_TEXTS.START) {
      console.log(`[${chatId}] Start.`)
      await this.sendMessage(chatId, BOT_TEXTS.GREETING)
      return
    }

    if (text === BOT_TEXTS.CLEAR) {
      console.log(`[${chatId}] Clear.`)
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

    if (chat.files.length === 0) {
      await this.sendMessage(chatId, BOT_TEXTS.NO_FILES)
      return
    }

    const prompt = text === undefined ? (caption === undefined ? '' : caption.trim()) : text.trim()
    if (prompt !== '') {
      console.log(`[${chatId}] Prompt set.`)
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
      console.log(`[${chatId}] Busy.`)
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
      await this.uploadChatFiles(chat)

      const prompt = await this.yandexTranslateService.translate(chat.prompt)

      const files = await runner(prompt, {
        images: getChatImages(chat),
        videos: getChatVideos(chat),
      })

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
    } catch (e: unknown) {
      console.log(`[${chatId}] Generation failed.`)
      console.log(e)
      if (e instanceof ReplicateApiError) {
        await this.sendMessage(chatId, mapReplicateError(e.message))
      } else {
        await this.sendMessage(chatId, BOT_TEXTS.ERROR)
      }
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

    const imagesLength = getChatImages(chat).length
    const videosLength = getChatVideos(chat).length

    const hasPrompt = chat.prompt !== ''
    const hasImages = imagesLength > 0
    const hasVideo = videosLength > 0

    if (!hasImages && !hasVideo) {
      text = BOT_TEXTS.FILES_REQUIRED
    } else if ((!hasPrompt && !hasVideo) || (hasVideo && !hasImages)) {
      text = ''
      if (hasImages) {
        text += `${BOT_TEXTS.UPLOADED_IMAGES}${imagesLength}\n`
      }
      if (hasVideo) {
        text += `${BOT_TEXTS.UPLOADED_VIDEOS}${videosLength}\n`
      }
      if (hasVideo && !hasImages) {
        text += BOT_TEXTS.UPLOAD_IMAGE
      } else {
        text += `\n${BOT_TEXTS.UPLOAD_MORE}`
      }
      keyboard.push([{ text: BOT_TEXTS.CLEAR }])
    }

    if (text !== null) {
      await this.sendMessage(chatId, text, {
        reply_markup: {
          keyboard,
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      })
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
    const imagesLength = getChatImages(chat).length
    const videosLength = getChatVideos(chat).length
    const hasImages = imagesLength > 0
    const hasVideo = videosLength > 0
    const keyboard: KeyboardButton[][] = []

    keyboard.push([{ text: BOT_TEXTS.CLEAR }])

    if (hasVideo) {
      keyboard.push([{ text: BOT_MODELS.KLING_MC }])
    } else {
      keyboard.push([{ text: BOT_MODELS.FLUX }, { text: BOT_MODELS.FLUX_9_16 }])
      keyboard.push([{ text: BOT_MODELS.SEEDREAM }, { text: BOT_MODELS.SEEDREAM_9_16 }])
      keyboard.push([{ text: BOT_MODELS.KLING }, { text: BOT_MODELS.NANO_BANANA_PRO }])
    }

    let text = ''
    if (hasImages) {
      text += `${BOT_TEXTS.UPLOADED_IMAGES}${imagesLength}\n`
    }
    if (hasVideo) {
      text += `${BOT_TEXTS.UPLOADED_VIDEOS}${videosLength}\n`
    }
    if (hasImages || hasVideo) {
      text += '\n'
    }
    text += BOT_TEXTS.SELECT_MODEL

    await this.sendMessage(chatId, text, {
      reply_markup: {
        keyboard,
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    })
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

      const link = await this.bot.getFileLink(file_id)
      this.store.addFile(chatId, link, mime_type)
      console.log(`[${chatId}] File added.`)

      this.schedulePrompt(chatId)
    } catch {
      console.log(`[${chatId}] Invalid file.`)
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

      this.store.addFile(chatId, fileLink, 'image/jpeg')

      console.log(`[${chatId}] Image added.`)

      this.schedulePrompt(chatId, 500)
    } catch {
      console.log(`[${chatId}] Invalid image.`)
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

      this.store.addFile(chatId, fileLink, mime_type)

      console.log(`[${chatId}] Video added.`)

      this.schedulePrompt(chatId, 500)
    } catch {
      console.log(`[${chatId}] Invalid video.`)
      await this.sendMessage(chatId, BOT_TEXTS.INVALID_VIDEO)
    }
  }
}
