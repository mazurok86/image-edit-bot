import type { KeyboardButton } from 'node-telegram-bot-api'
import { BOT_TEXTS } from '../../constants/botTexts.js'
import { escapeMarkdownV2, mapReplicateError } from '../../helpers/stringHelpers.js'
import { ReplicateApiError } from '../../errors/ReplicateApiError.js'
import { getModel } from '../../models/registry.js'
import type { ModelKey } from '../../models/registry.js'
import type { FileOutput } from '../../types/fileOutput.js'
import type { Files } from '../../types/files.js'
import type { ChatFile } from '../../types/chatFile.js'
import { Handler } from './handler.js'
import type { ChatStore } from '../../state/chatStore.js'

export class GenerationHandler extends Handler {
  async generate(chat: ChatStore, prompt: string): Promise<void> {
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

    try {
      await this.ctx.sendMessage(chat.id, `${BOT_TEXTS.USING_MODEL}${escapeMarkdownV2(model.name)}`)
      chat.files = await this.uploadChatFiles(chat.files)

      const translatedPrompt = await this.ctx.yandexTranslateService.translate(prompt)

      const files = await this.invokeRunner(chat, modelKey, translatedPrompt, {
        images: chat.images,
        videos: chat.videos,
      })

      for (const { buffer, filename, contentType } of files) {
        await this.ctx.bot.sendChatAction(chat.id, 'upload_document')
        await this.ctx.bot.sendDocument(chat.id, buffer, {}, { filename, contentType })
      }
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
    keyboard.push([{ text: BOT_TEXTS.MODEL_SETTINGS }])
    keyboard.push([{ text: BOT_TEXTS.BACK }])

    await this.ctx.sendMessage(chat.id, BOT_TEXTS.FILES_CLEARED, {
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

    const imagesLength = chat.images.length
    const videosLength = chat.videos.length
    const hasImages = imagesLength > 0
    const hasVideo = videosLength > 0
    const keyboard: KeyboardButton[][] = []

    let text = ''
    if (!hasImages && !hasVideo) {
      text = BOT_TEXTS.FILES_REQUIRED
    } else {
      keyboard.push([{ text: BOT_TEXTS.CLEAR }])
      if (hasImages) {
        text += `${BOT_TEXTS.UPLOADED_IMAGES}${imagesLength}\n`
      }
      if (hasVideo) {
        text += `${BOT_TEXTS.UPLOADED_VIDEOS}${videosLength}\n`
      }
      text += `\n${BOT_TEXTS.UPLOAD_MORE}`
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

  private invokeRunner<M extends ModelKey>(chat: ChatStore, modelKey: M, prompt: string, files: Files): Promise<FileOutput[]> {
    const options = chat.getModelOptions(modelKey)
    return this.ctx.runners[modelKey](prompt, files, options)
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
