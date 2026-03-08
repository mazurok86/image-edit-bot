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

  schedulePrompt(chatId: number, delay: number = 0): void {
    const chat = this.store.get(chatId)
    chat.scheduleResponse(() => {
      this.generationHandler.handlePrompt(chatId).catch(() => {})
    }, delay)
  }

  private async handleMessage(msg: Message): Promise<void> {
    const chatId = msg.chat.id
    const messageId = msg.message_id

    if (!this.allowedChatIds.includes(chatId)) {
      console.log(`[${chatId}] Bye.`)
      await this.sendMessage(chatId, BOT_TEXTS.BYE)
      return
    }

    const chat = this.store.get(chatId)

    const { text, caption, document, photo, video } = msg

    if (text === BOT_TEXTS.START) {
      console.log(`[${chatId}] Start.`)
      await this.sendMessage(chatId, BOT_TEXTS.GREETING)
      return
    }

    if (chat.modelKey === undefined) {
      await this.modelSelectionHandler.handleModelSelection(chatId, messageId, text)
      return
    }

    if (text === BOT_TEXTS.MODEL_SETTINGS) {
      await this.modelSettingsHandler.handleModelSettings(chatId, messageId)
      return
    }

    if (document) {
      await this.fileHandler.handleDocument(chatId, document)
      return
    }

    if (photo) {
      await this.fileHandler.handlePhoto(chatId, photo)
      return
    }

    if (video) {
      await this.fileHandler.handleVideo(chatId, video)
      return
    }

    if (chat.images.length === 0 && chat.videos.length === 0) {
      await this.sendMessage(chatId, BOT_TEXTS.NO_FILES)
      return
    }

    const prompt = text === undefined ? (caption === undefined ? '' : caption.trim()) : text.trim()
    if (prompt !== '') {
      console.log(`[${chatId}] Prompt set.`)
      chat.prompt = prompt
      await this.generationHandler.generate(chatId)
      return
    }

    this.schedulePrompt(chatId)
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

    const chat = this.store.get(chatId)

    if (chat.modelKey !== undefined) {
      await this.modelSettingsHandler.handleModelSettingsCallback(chatId, messageId, chat.modelKey, data)
    }

    await this.bot.answerCallbackQuery(query.id)
  }
}
