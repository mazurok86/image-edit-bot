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

export class ModelSettingsHandler extends Handler {
  async handleModelSettings(chatId: number, messageId: number): Promise<void> {
    const chat = this.getChat(chatId)
    if (chat.modelKey === undefined) {
      return
    }

    const modelKey = chat.modelKey
    const keyboard = this.buildMenu(chatId, modelKey)

    await this.ctx.bot.deleteMessage(chatId, messageId)
    await this.ctx.sendMessage(chatId, BOT_TEXTS.MODEL_SETTINGS, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    })
  }

  async handleModelSettingsCallback<M extends ModelKey>(chatId: number, messageId: number, modelKey: M, data: string): Promise<void> {
    const arr = data.split('#', 3)
    const action = arr[0]
    const capKeyStr = arr[1]
    const capKey = capKeyStr !== undefined && isModelCapabilityKey(capKeyStr, modelKey) ? capKeyStr : undefined
    const capValueStr = arr[2]
    const capValue =
      capValueStr !== undefined && capKey !== undefined && isModelCapabilityValue(capValueStr, modelKey, capKey) ? capValueStr : undefined

    if (action === 'set' && capKey !== undefined) {
      await this.handleActionSet(chatId, messageId, modelKey, capKey)
    }

    if (action === 'choose' && capKey !== undefined && capValue !== undefined) {
      await this.handleActionChoose(chatId, messageId, modelKey, capKey, capValue)
    }

    if (action === 'back') {
      await this.handleActionBack(chatId, messageId, modelKey)
    }
  }

  private async handleActionSet<M extends ModelKey, C extends ModelCapabilityKey<M>>(
    chatId: number,
    messageId: number,
    modelKey: M,
    capKey: C,
  ): Promise<void> {
    const cap = getModelCapability(modelKey, capKey)
    const currentValue = this.getChat(chatId).getModelOption(modelKey, capKey)

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
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: keyboard },
    })
  }

  private async handleActionChoose<M extends ModelKey, C extends ModelCapabilityKey<M>, V extends ModelCapabilityValue<M, C>>(
    chatId: number,
    messageId: number,
    modelKey: M,
    capKey: C,
    value: V,
  ): Promise<void> {
    this.getChat(chatId).setStateModelOption(modelKey, capKey, value)

    await this.editMessageMenu(chatId, messageId, modelKey)
  }

  private async handleActionBack<M extends ModelKey>(chatId: number, messageId: number, modelKey: M): Promise<void> {
    await this.editMessageMenu(chatId, messageId, modelKey)
  }

  private async editMessageMenu<M extends ModelKey>(chatId: number, messageId: number, modelKey: M): Promise<void> {
    const keyboard = this.buildMenu(chatId, modelKey)

    await this.ctx.bot.editMessageText(BOT_TEXTS.MODEL_SETTINGS, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: keyboard },
    })
  }

  private buildMenu<M extends ModelKey>(chatId: number, modelKey: M): InlineKeyboardButton[][] {
    const options = this.getChat(chatId).getModelOptions(modelKey)
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
}
