import type { InlineKeyboardButton } from 'node-telegram-bot-api'
import { Handler } from './handler.js'
import {
  getModelCapabilities,
  getModelCapability,
  isModelCapabilityKey,
  isModelCapabilityValue,
  type ModelKey,
} from '../../models/registry.js'
import { BOT_TEXTS } from '../../constants/botTexts.js'
import { recordToEntries } from '../../helpers/arrayHelpers.js'
import type { ModelCapabilityKey, ModelCapabilityValue } from '../../types/model.js'
import type { ChatStore } from '../../state/chatStore.js'

export class ModelSettingsHandler extends Handler {
  async handleModelSettingsCleanup(chat: ChatStore): Promise<void> {
    if (chat.modelKey === undefined) {
      return
    }

    const modelKey = chat.modelKey

    const settingsMessageId = chat.getSettingsMessageId(modelKey)
    chat.setSettingsMessageId(modelKey, undefined)

    if (settingsMessageId !== undefined) {
      await this.cleanup(chat.id, settingsMessageId)
    }
  }

  async handleModelSettings(chat: ChatStore, messageId: number): Promise<void> {
    if (chat.modelKey === undefined) {
      return
    }

    const modelKey = chat.modelKey
    const keyboard = this.buildMenu(chat, modelKey)

    try {
      await this.ctx.bot.deleteMessage(chat.id, messageId)
    } catch {
      // ignore
    }

    const message = await this.ctx.sendMessage(chat.id, BOT_TEXTS.MODEL_SETTINGS, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    })

    const settingsMessageId = chat.getSettingsMessageId(modelKey)
    chat.setSettingsMessageId(modelKey, message.message_id)

    if (settingsMessageId !== undefined) {
      await this.cleanup(chat.id, settingsMessageId)
    }
  }

  async handleModelSettingsCallback(chat: ChatStore, messageId: number, data: string): Promise<void> {
    const modelKey = chat.modelKey

    if (modelKey === undefined) {
      await this.cleanup(chat.id, messageId)
      return
    }

    const settingsMessageId = chat.getSettingsMessageId(modelKey)

    if (settingsMessageId !== undefined && messageId !== settingsMessageId) {
      await this.cleanup(chat.id, messageId)
      return
    }

    const arr = data.split('#', 3)
    const action = arr[0]
    const capKeyStr = arr[1]
    const capKey = capKeyStr !== undefined && isModelCapabilityKey(capKeyStr, modelKey) ? capKeyStr : undefined
    const capValueStr = arr[2]
    const capValue =
      capValueStr !== undefined && capKey !== undefined && isModelCapabilityValue(capValueStr, modelKey, capKey) ? capValueStr : undefined

    if (action === 'set' && capKey !== undefined) {
      await this.handleActionSet(chat, messageId, modelKey, capKey)
    }

    if (action === 'choose' && capKey !== undefined && capValue !== undefined) {
      await this.handleActionChoose(chat, messageId, modelKey, capKey, capValue)
    }

    if (action === 'back') {
      await this.handleActionBack(chat, messageId, modelKey)
    }
  }

  private async handleActionSet<M extends ModelKey, C extends ModelCapabilityKey<M>>(
    chat: ChatStore,
    messageId: number,
    modelKey: M,
    capKey: C,
  ): Promise<void> {
    const cap = getModelCapability(modelKey, capKey)
    const currentValue = chat.getModelOption(modelKey, capKey)

    const keyboard: InlineKeyboardButton[][] = Object.entries(cap.valueLabels as Record<string, string>).map(([value, label]) => {
      return [
        {
          text: value === currentValue ? `✅ ${label}` : label,
          callback_data: `choose#${capKey}#${value}`,
        },
      ]
    })
    keyboard.push([{ text: BOT_TEXTS.BACK, callback_data: 'back' }])

    await this.ctx.bot.editMessageText(`${BOT_TEXTS.MODEL_SETTINGS}: ${cap.label as string}`, {
      chat_id: chat.id,
      message_id: messageId,
      reply_markup: { inline_keyboard: keyboard },
    })
  }

  private async handleActionChoose<M extends ModelKey, C extends ModelCapabilityKey<M>, V extends ModelCapabilityValue<M, C>>(
    chat: ChatStore,
    messageId: number,
    modelKey: M,
    capKey: C,
    value: V,
  ): Promise<void> {
    chat.setModelOption(modelKey, capKey, value)

    await this.editMessageMenu(chat, messageId, modelKey)
  }

  private async handleActionBack<M extends ModelKey>(chat: ChatStore, messageId: number, modelKey: M): Promise<void> {
    await this.editMessageMenu(chat, messageId, modelKey)
  }

  private async editMessageMenu<M extends ModelKey>(chat: ChatStore, messageId: number, modelKey: M): Promise<void> {
    const keyboard = this.buildMenu(chat, modelKey)

    await this.ctx.bot.editMessageText(BOT_TEXTS.MODEL_SETTINGS, {
      chat_id: chat.id,
      message_id: messageId,
      reply_markup: { inline_keyboard: keyboard },
    })
  }

  private buildMenu<M extends ModelKey>(chat: ChatStore, modelKey: M): InlineKeyboardButton[][] {
    const options = chat.getModelOptions(modelKey)
    const caps = getModelCapabilities(modelKey)

    const keyboard: InlineKeyboardButton[][] = []

    for (const [key, cap] of recordToEntries(caps)) {
      const value = options[key]
      const label = cap.valueLabels[value]
      keyboard.push([
        {
          text: `${String(cap.label)}: ${String(label)}`,
          callback_data: `set#${String(key)}`,
        },
      ])
    }

    return keyboard
  }

  private async cleanup(chatId: number, settingsMessageId: number): Promise<void> {
    try {
      await this.ctx.bot.editMessageReplyMarkup(
        {
          inline_keyboard: [],
        },
        {
          chat_id: chatId,
          message_id: settingsMessageId,
        },
      )
    } catch {
      // ignore
    }
  }
}
