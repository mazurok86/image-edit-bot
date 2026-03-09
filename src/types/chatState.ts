import type { ModelKey } from '../models/registry.js'
import type { ChatFile } from './chatFile.js'
import type { ModelCapabilitiesValue } from './model.js'

export type ChatStateModel<M extends ModelKey> = Partial<ModelCapabilitiesValue<M>>

export type ChatStateModels = {
  [K in ModelKey]?: ChatStateModel<K>
}

export type ChatStateSettingsMessagesIds = {
  [K in ModelKey]?: number
}

export interface ChatState {
  files: ChatFile[]
  filesExpireAt: number | undefined
  modelKey: ModelKey | undefined
  models: ChatStateModels
  settingsMessagesIds: ChatStateSettingsMessagesIds
}
