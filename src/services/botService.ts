import TelegramBot from 'node-telegram-bot-api'
import type { CallbackQuery, Message } from 'node-telegram-bot-api'
import { BOT_TEXTS } from '../constants/botTexts.js'
import type { ReplicateService } from './replicateService.js'
import type { YandexTranslateService } from './yandexTranslateService.js'
import type { ModelRunners } from '../types/model.js'
import type { BotContext } from './botContext.js'
import { FileHandler } from './handlers/fileHandler.js'
import { GenerationHandler } from './handlers/generationHandler.js'
import { ModelSelectionHandler } from './handlers/modelSelectionHandler.js'
import { ModelSettingsHandler } from './handlers/modelSettingsHandler.js'
import type { FileOutput } from '../types/fileOutput.js'
import type { ChatRegistry } from '../state/chatRegistry.js'
import type { ChatStore } from '../state/chatStore.js'
import { getModel } from '../models/registry.js'

export class BotService implements BotContext {
  readonly bot: TelegramBot
  readonly store: ChatRegistry
  readonly yandexTranslateService: YandexTranslateService
  readonly replicateService: ReplicateService
  private readonly allowedChatIds: number[]
  readonly runners: ModelRunners

  private readonly fileHandler: FileHandler
  private readonly generationHandler: GenerationHandler
  private readonly modelSelectionHandler: ModelSelectionHandler
  private readonly modelSettingsHandler: ModelSettingsHandler

  constructor(
    bot: TelegramBot,
    store: ChatRegistry,
    yandexTranslateService: YandexTranslateService,
    replicateService: ReplicateService,
    allowedChatIds: number[],
  ) {
    this.allowedChatIds = allowedChatIds
    this.bot = bot
    this.store = store
    this.yandexTranslateService = yandexTranslateService
    this.replicateService = replicateService

    this.runners = {
      qwen: async (prompt, files, settings): Promise<FileOutput[]> => {
        return await this.replicateService.runQwen(prompt, files.images, settings)
      },
      flux2: async (prompt, files, settings): Promise<FileOutput[]> => {
        return await this.replicateService.runFlux2(prompt, files.images, settings)
      },
      flux1: async (prompt, files, settings): Promise<FileOutput[]> => {
        return await this.replicateService.runFlux(prompt, files.images[files.images.length - 1], settings)
      },
      seedream: async (prompt, files, settings): Promise<FileOutput[]> => {
        return await this.replicateService.runSeedream4(prompt, files.images, settings)
      },
      nanoBanana: async (prompt, files, settings): Promise<FileOutput[]> => {
        return await this.replicateService.runNanoBananaPro(prompt, files.images, settings)
      },
      kling: async (prompt, files, settings): Promise<FileOutput[]> => {
        return await this.replicateService.runKling(prompt, files.images[files.images.length - 1], settings)
      },
      klingMC: async (prompt, files, settings): Promise<FileOutput[]> => {
        return await this.replicateService.runKlingMotionControl(
          prompt,
          files.images[files.images.length - 1],
          files.videos[files.videos.length - 1],
          settings,
        )
      },
    }

    this.fileHandler = new FileHandler(this)
    this.generationHandler = new GenerationHandler(this)
    this.modelSelectionHandler = new ModelSelectionHandler(this)
    this.modelSettingsHandler = new ModelSettingsHandler(this)
  }

  public start(): void {
    console.log('Bot running...')
    this.bot.on('callback_query', (query: CallbackQuery) => this.handleCallbackQuery(query))
    this.bot.on('message', (msg: Message) => this.handleMessage(msg))
  }

  async sendMessage(chatId: number, text: string, options?: TelegramBot.SendMessageOptions): Promise<TelegramBot.Message> {
    return await this.bot.sendMessage(chatId, text, {
      ...options,
      parse_mode: 'MarkdownV2',
    })
  }

  schedulePrompt(chat: ChatStore, delay: number = 0): void {
    chat.scheduleResponse(() => {
      this.generationHandler.handlePrompt(chat).catch(() => {})
    }, delay)
  }

  isReady(chat: ChatStore): boolean {
    const modelKey = chat.modelKey
    if (modelKey === undefined) {
      return false
    }

    const model = getModel(modelKey)

    if (chat.images.length < model.minImages || chat.videos.length < model.minVideo) {
      return false
    }

    if (model.requirePrompt && chat.prompt === '') {
      return false
    }

    return true
  }

  private async handleMessage(msg: Message): Promise<void> {
    const chatId = msg.chat.id
    const messageId = msg.message_id

    if (!this.allowedChatIds.includes(chatId)) {
      console.log(`[${chatId}] Bye.`)
      await this.sendMessage(chatId, BOT_TEXTS.BYE)
      return
    }

    const chat = await this.store.get(chatId)

    const { text, caption, document, photo, video } = msg

    if (text === BOT_TEXTS.START) {
      console.log(`[${chatId}] Start.`)
      await this.sendMessage(chatId, BOT_TEXTS.GREETING)
      return
    }

    if (chat.modelKey === undefined || text === BOT_TEXTS.BACK) {
      await this.modelSettingsHandler.handleModelSettingsCleanup(chat)
      await this.modelSelectionHandler.handleModelSelection(chat, messageId, text)
      return
    }

    if (text === BOT_TEXTS.MODEL_SETTINGS) {
      await this.modelSettingsHandler.handleModelSettings(chat, messageId)
      return
    }

    if (text === BOT_TEXTS.CLEAR) {
      await this.generationHandler.handleClear(chat, messageId)
      return
    }

    if (text === BOT_TEXTS.START_GENERATION) {
      await this.generationHandler.generate(chat, messageId)
      this.schedulePrompt(chat, 500)
      return
    }

    if (document) {
      await this.fileHandler.handleDocument(chat, document)
    }

    if (photo) {
      await this.fileHandler.handlePhoto(chat, photo)
    }

    if (video) {
      await this.fileHandler.handleVideo(chat, video)
    }

    const prompt = text === undefined ? (caption === undefined ? '' : caption.trim()) : text.trim()
    if (prompt !== '') {
      console.log(`[${chat.id}] Prompt specified.`)
      chat.prompt = prompt
    }

    this.schedulePrompt(chat, 500)
  }

  private async handleCallbackQuery(query: CallbackQuery): Promise<void> {
    const { data, message: msg } = query

    if (msg === undefined || data === undefined) {
      return
    }

    const chatId = msg.chat.id
    const messageId = msg.message_id

    if (!this.allowedChatIds.includes(chatId)) {
      return
    }

    const chat = await this.store.get(chatId)

    await this.modelSettingsHandler.handleModelSettingsCallback(chat, messageId, data)

    await this.bot.answerCallbackQuery(query.id)
  }
}
