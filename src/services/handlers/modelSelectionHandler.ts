import type { KeyboardButton } from 'node-telegram-bot-api'
import { BOT_TEXTS } from '../../constants/botTexts.js'
import { getModel, getModelKeyByName, getModelNames } from '../../models/registry.js'
import { Handler } from './handler.js'
import { chunkArray } from '../../helpers/arrayHelpers.js'
import { escapeMarkdownV2 } from '../../helpers/stringHelpers.js'
import type { ChatStore } from '../../state/chatStore.js'

export class ModelSelectionHandler extends Handler {
  async handleModelSelection(chat: ChatStore, messageId: number, text?: string): Promise<void> {
    const isBack = text === BOT_TEXTS.BACK

    chat.modelKey = text === undefined || isBack ? undefined : getModelKeyByName(text)

    const modelKey = chat.modelKey

    if (modelKey !== undefined || isBack) {
      try {
        await this.ctx.bot.deleteMessage(chat.id, messageId)
      } catch {
        // ignore
      }
    }

    if (modelKey === undefined) {
      const items: KeyboardButton[] = []
      for (const name of getModelNames()) {
        items.push({ text: name })
      }
      const keyboard: KeyboardButton[][] = chunkArray(items, 2)
      await this.ctx.sendMessage(chat.id, BOT_TEXTS.SELECT_MODEL, {
        reply_markup: {
          keyboard,
          resize_keyboard: true,
        },
      })
    } else {
      const model = getModel(modelKey)
      const keyboard: KeyboardButton[][] = []

      if (this.ctx.isReady(chat)) {
        keyboard.push([{ text: BOT_TEXTS.START_GENERATION }])
      }
      if (this.ctx.hasInputs(chat)) {
        keyboard.push([{ text: BOT_TEXTS.CLEAR }])
      }
      keyboard.push([{ text: BOT_TEXTS.MODEL_SETTINGS }])
      keyboard.push([{ text: BOT_TEXTS.BACK }])

      await this.ctx.sendMessage(chat.id, escapeMarkdownV2(model.name), {
        reply_markup: {
          keyboard,
          resize_keyboard: true,
        },
      })
    }
  }
}
