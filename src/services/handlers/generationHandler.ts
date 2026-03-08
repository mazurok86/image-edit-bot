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

export class GenerationHandler extends Handler {
  async generate(chatId: number): Promise<void> {
    const ok = await this.checkPrompt(chatId)
    if (!ok) {
      return
    }

    const chat = this.getChat(chatId)

    const modelKey = chat.modelKey
    if (modelKey === undefined) {
      return
    }

    if (chat.busy) {
      console.log(`[${chatId}] Busy.`)
      await this.ctx.sendMessage(chatId, BOT_TEXTS.BUSY)
      return
    }

    chat.busy = true

    console.log(`[${chatId}] Generation started.`)

    await this.ctx.bot.sendChatAction(chatId, 'upload_document')
    const handle = setInterval(() => {
      this.ctx.bot.sendChatAction(chatId, 'upload_document').catch(() => {})
    }, 5000)

    const model = getModel(modelKey)

    try {
      await this.ctx.sendMessage(chatId, `${BOT_TEXTS.USING_MODEL}${escapeMarkdownV2(model.name)}`)
      chat.files = await this.uploadChatFiles(chat.files)

      const prompt = await this.ctx.yandexTranslateService.translate(chat.prompt)

      const files = await this.invokeRunner(
        modelKey,
        prompt,
        {
          images: chat.images,
          videos: chat.videos,
        },
        chatId,
      )

      for (const { buffer, filename, contentType } of files) {
        await this.ctx.bot.sendChatAction(chatId, 'upload_document')
        await this.ctx.bot.sendDocument(chatId, buffer, {}, { filename, contentType })
      }
    } catch (e: unknown) {
      console.log(`[${chatId}] Generation failed.`)
      console.log(e)
      if (e instanceof ReplicateApiError) {
        await this.ctx.sendMessage(chatId, mapReplicateError(e.message))
      } else {
        await this.ctx.sendMessage(chatId, BOT_TEXTS.ERROR)
      }
    } finally {
      console.log(`[${chatId}] Generation finished.`)
      clearInterval(handle)
      chat.busy = false
      this.ctx.schedulePrompt(chatId)
    }
  }

  async checkPrompt(chatId: number): Promise<boolean> {
    const chat = this.getChat(chatId)

    const keyboard: KeyboardButton[][] = []
    let text: string | null = null

    const imagesLength = chat.images.length
    const videosLength = chat.videos.length
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
      await this.ctx.sendMessage(chatId, text, {
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

  async handlePrompt(chatId: number): Promise<void> {
    const ok = await this.checkPrompt(chatId)
    if (!ok) {
      return
    }

    const chat = this.getChat(chatId)

    const imagesLength = chat.images.length
    const videosLength = chat.videos.length
    const hasImages = imagesLength > 0
    const hasVideo = videosLength > 0
    const keyboard: KeyboardButton[][] = []

    keyboard.push([{ text: BOT_TEXTS.CLEAR }])

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

    await this.ctx.sendMessage(chatId, text, {
      reply_markup: {
        keyboard,
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    })
  }

  private invokeRunner<M extends ModelKey>(modelKey: M, prompt: string, files: Files, chatId: number): Promise<FileOutput[]> {
    const chat = this.getChat(chatId)
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
