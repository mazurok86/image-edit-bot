import { isAllowedImage, isAllowedVideo } from '../helpers/fileHelpers.js'
import { isRecord } from '../helpers/generalHelpers.js'
import { getModelCapabilityValue, getModelCapabilitiesValue, type ModelKey, isModelKey } from '../models/registry.js'
import type { RedisService } from '../services/redisService.js'
import type { ChatFile } from '../types/chatFile.js'
import type { ChatState, ChatStateModel, ChatStateModels, ChatStateSettingsMessagesIds } from '../types/chatState.js'
import type { FileMimeType } from '../types/fileMimeType.js'
import type { ModelCapabilityValue, ModelCapabilitiesValue, ModelCapabilityKey } from '../types/model.js'

export class ChatStore {
  constructor(
    public readonly id: number,
    private readonly redis: RedisService,
  ) {}

  private _responseTimeout: NodeJS.Timeout | undefined = undefined
  private _busy: boolean = false

  private readonly state: ChatState = {
    files: [],
    filesExpireAt: undefined,
    modelKey: undefined,
    models: {},
    settingsMessagesIds: {},
  }

  private get key(): string {
    return `chat:${this.id}`
  }

  private persist(): void {
    this.redis.set(this.key, JSON.stringify(this.state)).catch((err: unknown) => {
      console.error(`[ChatStore] Redis persist failed for chat ${this.id}:`, err)
    })
  }

  async load(): Promise<void> {
    let raw: string | null
    try {
      raw = await this.redis.get(this.key)
    } catch (err: unknown) {
      console.error(`[ChatStore] Redis load failed for chat ${this.id}:`, err)
      return
    }
    if (raw === null) {
      return
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      console.error(`[ChatStore] JSON parse error for chat ${this.id}, discarding stored state`)
      return
    }

    if (!isRecord(parsed)) {
      return
    }

    const { files, modelKey, models, settingsMessagesIds } = parsed

    if (Array.isArray(files)) this.state.files = files as ChatFile[]
    if (isModelKey(modelKey)) this.state.modelKey = modelKey
    if (models !== undefined && typeof models === 'object') this.state.models = models as ChatStateModels
    if (settingsMessagesIds !== undefined && typeof settingsMessagesIds === 'object') {
      this.state.settingsMessagesIds = settingsMessagesIds as ChatStateSettingsMessagesIds
    }
  }

  get modelKey(): ModelKey | undefined {
    return this.state.modelKey
  }

  set modelKey(value: ModelKey | undefined) {
    this.state.modelKey = value
    this.persist()
  }

  get busy(): boolean {
    return this._busy
  }

  set busy(value: boolean) {
    this._busy = value
  }

  get files(): readonly ChatFile[] {
    if (this.state.filesExpireAt !== undefined && Date.now() >= this.state.filesExpireAt) {
      this.state.filesExpireAt = undefined
      this.state.files = []
    }
    return this.state.files
  }

  set files(value: ChatFile[]) {
    this.state.files = value
    this.persist()
  }

  get images(): string[] {
    const images = []
    for (const { url, mimeType } of this.files) {
      if (isAllowedImage(mimeType)) {
        images.push(url)
      }
    }
    return images
  }

  get videos(): string[] {
    const videos = []
    for (const { url, mimeType } of this.files) {
      if (isAllowedVideo(mimeType)) {
        videos.push(url)
      }
    }
    return videos
  }

  private getStateModelOptions<M extends ModelKey>(modelKey: M): Readonly<ChatStateModel<M>> | undefined {
    return this.state.models[modelKey]
  }

  getModelOption<M extends ModelKey, C extends ModelCapabilityKey<M>>(modelKey: M, capKey: C): ModelCapabilityValue<M, C> {
    const option = getModelCapabilityValue(modelKey, capKey)
    const stateValues = this.getStateModelOptions(modelKey)
    if (stateValues !== undefined && stateValues[capKey] !== undefined) {
      return stateValues[capKey]
    }
    return option
  }

  getModelOptions<M extends ModelKey>(modelKey: M): Readonly<ModelCapabilitiesValue<M>> {
    const options = getModelCapabilitiesValue(modelKey)
    const stateValues = this.getStateModelOptions(modelKey)
    if (stateValues !== undefined) {
      return { ...options, ...stateValues }
    }
    return options
  }

  setModelOption<M extends ModelKey, C extends ModelCapabilityKey<M>>(modelKey: M, capKey: C, value: ModelCapabilityValue<M, C>): void {
    const options = this.state.models[modelKey]
    if (options === undefined) {
      this.state.models[modelKey] = { [capKey]: value }
    } else {
      options[capKey] = value
      this.state.models[modelKey] = options
    }
    this.persist()
  }

  getSettingsMessageId(modelKey: ModelKey): number | undefined {
    return this.state.settingsMessagesIds[modelKey]
  }

  setSettingsMessageId(modelKey: ModelKey, messageId: number | undefined): void {
    if (messageId === undefined) {
      delete this.state.settingsMessagesIds[modelKey]
    } else {
      this.state.settingsMessagesIds[modelKey] = messageId
    }
    this.persist()
  }

  clear(): void {
    this.state.files = []
    this.state.filesExpireAt = undefined
    this.persist()
  }

  addFile(url: string, mimeType: FileMimeType): void {
    if (this.state.filesExpireAt === undefined) {
      this.state.filesExpireAt = Date.now() + 3600 * 1000
    }

    this.state.files.push({ url, mimeType })

    this.persist()
  }

  scheduleResponse(callback: () => void, delay: number): void {
    if (this._responseTimeout !== undefined) {
      clearTimeout(this._responseTimeout)
      this._responseTimeout = undefined
    }
    this._responseTimeout = setTimeout(callback, delay)
  }
}
