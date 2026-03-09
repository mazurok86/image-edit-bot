import type TelegramBot from 'node-telegram-bot-api'
import type { ChatRegistry } from '../state/chatRegistry.js'
import type { ReplicateService } from './replicateService.js'
import type { YandexTranslateService } from './yandexTranslateService.js'
import type { ModelRunners } from '../types/model.js'

export interface BotContext {
  readonly bot: TelegramBot
  readonly store: ChatRegistry
  readonly replicateService: ReplicateService
  readonly yandexTranslateService: YandexTranslateService
  readonly runners: ModelRunners
  sendMessage(chatId: number, text: string, options?: TelegramBot.SendMessageOptions): Promise<TelegramBot.Message>
}
