import type { KeyboardButton } from 'node-telegram-bot-api'
import { BOT_TEXTS } from '../../constants/botTexts.js'
import { escapeMarkdownV2, mapReplicateError } from '../../helpers/stringHelpers.js'
import { ReplicateApiError } from '../../errors/ReplicateApiError.js'
import { getModel, getModelCapabilities } from '../../models/registry.js'
import type { ModelKey } from '../../models/registry.js'
import type { FileOutput } from '../../types/fileOutput.js'
import type { Files } from '../../types/files.js'
import type { ChatFile } from '../../types/chatFile.js'
import { Handler } from './handler.js'
import type { ChatStore } from '../../state/chatStore.js'
import type { ModelCapabilities, ModelCapabilitiesValue } from '../../types/model.js'
import { recordToEntries } from '../../helpers/arrayHelpers.js'

export class GenerationHandler extends Handler {
  async generate(chat: ChatStore, messageId: number): Promise<void> {
    try {
      await this.ctx.bot.deleteMessage(chat.id, messageId)
    } catch {
      // ignore
    }

    const modelKey = chat.modelKey
    if (modelKey === undefined) {
      return
    }

    if (chat.busy) {
      console.log(`[${chat.id}] Busy.`)
      await this.ctx.sendMessage(chat.id, BOT_TEXTS.BUSY)
      return
    }

    chat.busy = true

    console.log(`[${chat.id}] Generation started.`)

    await this.ctx.bot.sendChatAction(chat.id, 'upload_document')
    const handle = setInterval(() => {
      this.ctx.bot.sendChatAction(chat.id, 'upload_document').catch(() => {})
    }, 5000)

    const model = getModel(modelKey)
    const startedAt = Date.now()

    try {
      await this.ctx.sendMessage(chat.id, `${BOT_TEXTS.USING_MODEL}${escapeMarkdownV2(model.name)}`)
      chat.files = await this.uploadChatFiles(chat.files)
      const images = chat.images
      const videos = chat.videos

      const translatedPrompt = await this.ctx.yandexTranslateService.translate(chat.prompt)
      const options = chat.getModelOptions(modelKey)

      const files = await this.invokeRunner(options, modelKey, translatedPrompt, {
        images,
        videos,
      })

      for (const { buffer, filename, contentType } of files) {
        await this.ctx.bot.sendChatAction(chat.id, 'upload_document')
        await this.ctx.bot.sendDocument(chat.id, buffer, {}, { filename, contentType })
      }

      const elapsedSec = Math.round((Date.now() - startedAt) / 1000)
      const capabilities = getModelCapabilities(modelKey)
      const optionsLines = this.buildOptions(options, capabilities)
      const doneText = optionsLines
        ? `${BOT_TEXTS.GENERATION_DONE} \\(${elapsedSec} сек\\.\\)\n\n${optionsLines}`
        : `${BOT_TEXTS.GENERATION_DONE} \\(${elapsedSec} сек\\.\\)`

      await this.ctx.sendMessage(chat.id, doneText)
    } catch (e: unknown) {
      console.log(`[${chat.id}] Generation failed.`)
      console.log(e)
      if (e instanceof ReplicateApiError) {
        await this.ctx.sendMessage(chat.id, mapReplicateError(e.message))
      } else {
        await this.ctx.sendMessage(chat.id, BOT_TEXTS.ERROR)
      }
    } finally {
      console.log(`[${chat.id}] Generation finished.`)
      clearInterval(handle)
      chat.busy = false
    }
  }

  async handleClear(chat: ChatStore, messageId: number): Promise<void> {
    chat.clear()

    try {
      await this.ctx.bot.deleteMessage(chat.id, messageId)
    } catch {
      // ignore
    }

    const keyboard: KeyboardButton[][] = []

    if (this.ctx.isReady(chat)) {
      keyboard.push([{ text: BOT_TEXTS.START_GENERATION }])
    }
    keyboard.push([{ text: BOT_TEXTS.MODEL_SETTINGS }])
    keyboard.push([{ text: BOT_TEXTS.BACK }])

    await this.ctx.sendMessage(chat.id, BOT_TEXTS.CLEARED, {
      reply_markup: {
        keyboard,
        resize_keyboard: true,
      },
    })
  }

  async handlePrompt(chat: ChatStore): Promise<void> {
    const modelKey = chat.modelKey
    if (modelKey === undefined) {
      return
    }

    const model = getModel(modelKey)

    const imagesLength = chat.images.length
    const videosLength = chat.videos.length
    const hasImages = imagesLength > 0
    const hasVideo = videosLength > 0

    let text = ''
    if (!hasImages && !hasVideo) {
      text += BOT_TEXTS.FILES_REQUIRED
    } else {
      text += BOT_TEXTS.ACCEPTED
      const needPrompt = imagesLength >= model.minImages && videosLength >= model.minVideo && model.requirePrompt && chat.prompt === ''
      if (hasImages || hasVideo || needPrompt) {
        text += `\n`
        if (hasImages) {
          text += `\n${BOT_TEXTS.UPLOADED_IMAGES}${imagesLength}`
        }
        if (hasVideo) {
          text += `\n${BOT_TEXTS.UPLOADED_VIDEOS}${videosLength}`
        }
        if (needPrompt) {
          text += `\n${BOT_TEXTS.ENTER_PROMPT}`
        }
      }
    }

    const keyboard: KeyboardButton[][] = []

    if (this.ctx.isReady(chat)) {
      keyboard.push([{ text: BOT_TEXTS.START_GENERATION }])
    }
    if (this.ctx.hasInputs(chat)) {
      keyboard.push([{ text: BOT_TEXTS.CLEAR }])
    }
    keyboard.push([{ text: BOT_TEXTS.MODEL_SETTINGS }])
    keyboard.push([{ text: BOT_TEXTS.BACK }])

    await this.ctx.sendMessage(chat.id, text, {
      reply_markup: {
        keyboard,
        resize_keyboard: true,
      },
    })
  }

  private invokeRunner<M extends ModelKey>(
    options: Readonly<ModelCapabilitiesValue<M>>,
    modelKey: M,
    prompt: string,
    files: Files,
  ): Promise<FileOutput[]> {
    return this.ctx.runners[modelKey](prompt, files, options)
  }

  private buildOptions<M extends ModelKey>(options: Readonly<ModelCapabilitiesValue<M>>, capabilities: ModelCapabilities<M>): string {
    const optionsLines = recordToEntries(options)
      .map(([key, value]) => {
        const cap = capabilities[key]
        const valueLabel = cap.valueLabels[value]
        return `${escapeMarkdownV2(String(cap.label))}: ${escapeMarkdownV2(String(valueLabel))}`
      })
      .filter((line): line is string => line !== null)
      .join('\n')
    return optionsLines
  }

  private async uploadChatFiles(files: readonly ChatFile[]): Promise<ChatFile[]> {
    const result: ChatFile[] = []
    for (const file of files) {
      if (file.mimeType === 'image/heic') {
        file.url = await this.ctx.replicateService.uploadHeicImage(file.url)
        file.mimeType = 'image/jpeg'
      }
      result.push(file)
    }
    return result
  }
}
