import type { KeyboardButton } from 'node-telegram-bot-api'
import { BOT_TEXTS } from '../../constants/botTexts.js'
import { getModel, getModelKeyByName, getModelNames } from '../../models/registry.js'
import { Handler } from './handler.js'
import { chunkArray } from '../../helpers/arrayHelpers.js'
import { escapeMarkdownV2 } from '../../helpers/stringHelpers.js'

export class ModelSelectionHandler extends Handler {
  async handleModelSelection(chatId: number, messageId: number, text: string | undefined): Promise<void> {
    const chat = this.getChat(chatId)

    chat.modelKey = text === undefined ? undefined : getModelKeyByName(text)

    if (chat.modelKey === undefined) {
      const items: KeyboardButton[] = []
      for (const name of getModelNames()) {
        items.push({ text: name })
      }
      const keyboard: KeyboardButton[][] = chunkArray(items, 2)
      await this.ctx.sendMessage(chatId, BOT_TEXTS.SELECT_MODEL, {
        reply_markup: {
          keyboard,
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      })
    } else {
      const model = getModel(chat.modelKey)
      const keyboard: KeyboardButton[][] = [[{ text: BOT_TEXTS.MODEL_SETTINGS }]]
      try {
        await this.ctx.bot.deleteMessage(chatId, messageId)
      } catch {
        // ignore
      }
      await this.ctx.sendMessage(chatId, escapeMarkdownV2(model.name), {
        reply_markup: {
          keyboard,
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      })
    }
  }
}
