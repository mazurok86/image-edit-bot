import { isAllowedImage, isAllowedVideo } from '../helpers/fileHelpers.js'
import { getModelCapabilityValue, getModelCapabilitiesValue, type ModelKey } from '../models/registry.js'
import type { ChatFile } from '../types/chatFile.js'
import type { ChatState, ChatStateModel } from '../types/chatState.js'
import type { FileMimeType } from '../types/fileMimeType.js'
import type { ModelCapabilityValue, ModelCapabilitiesValue, ModelCapabilityKey } from '../types/model.js'

export class ChatStore {
  private readonly state: ChatState = {
    prompt: '',
    files: [],
    timeout: undefined,
    responseTimeout: undefined,
    busy: false,
    modelKey: undefined,
    models: {},
  }

  get modelKey(): ModelKey | undefined {
    return this.state.modelKey
  }
  set modelKey(value: ModelKey | undefined) {
    this.state.modelKey = value
  }

  get prompt(): string {
    return this.state.prompt
  }
  set prompt(value: string) {
    this.state.prompt = value
  }

  get busy(): boolean {
    return this.state.busy
  }
  set busy(value: boolean) {
    this.state.busy = value
  }

  get files(): readonly ChatFile[] {
    return this.state.files
  }
  set files(value: ChatFile[]) {
    this.state.files = value
  }

  get images(): string[] {
    const images = []
    for (const { url, mimeType } of this.state.files) {
      if (isAllowedImage(mimeType)) {
        images.push(url)
      }
    }
    return images
  }

  get videos(): string[] {
    const videos = []
    for (const { url, mimeType } of this.state.files) {
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

  setStateModelOption<M extends ModelKey, C extends ModelCapabilityKey<M>>(
    modelKey: M,
    capKey: C,
    value: ModelCapabilityValue<M, C>,
  ): void {
    const options = this.state.models[modelKey]
    if (options === undefined) {
      this.state.models[modelKey] = { [capKey]: value }
    } else {
      options[capKey] = value
      this.state.models[modelKey] = options
    }
  }

  clear(): void {
    this.state.prompt = ''
    this.state.files = []
  }

  addFile(url: string, mimeType: FileMimeType): void {
    if (this.state.timeout !== undefined) {
      clearTimeout(this.state.timeout)
      this.state.timeout = undefined
    }

    this.state.files.push({ url, mimeType })

    this.state.timeout = setTimeout(() => {
      this.clear()
    }, 3600000)
  }

  scheduleResponse(callback: () => void, delay: number): void {
    if (this.state.responseTimeout !== undefined) {
      clearTimeout(this.state.responseTimeout)
      this.state.responseTimeout = undefined
    }
    this.state.responseTimeout = setTimeout(callback, delay)
  }
}
