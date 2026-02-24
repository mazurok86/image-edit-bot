import type { ChatFile } from './chatFile.js'

export interface ChatState {
  prompt: string
  files: ChatFile[]
  timeout: NodeJS.Timeout | undefined
  responseTimeout: NodeJS.Timeout | undefined
  busy: boolean
}
