import type { ModelKey } from '../models/registry.js'
import type { ChatFile } from './chatFile.js'
import type { ModelCapabilitiesValue } from './model.js'

export type ChatStateModel<M extends ModelKey> = Partial<ModelCapabilitiesValue<M>>

type ChatStateModels = {
  [K in ModelKey]?: ChatStateModel<K>
}

export interface ChatState {
  prompt: string
  files: ChatFile[]
  timeout: NodeJS.Timeout | undefined
  responseTimeout: NodeJS.Timeout | undefined
  busy: boolean
  modelKey: ModelKey | undefined
  models: ChatStateModels
}
