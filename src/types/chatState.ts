export interface ChatState {
  prompt: string
  images: (string | Buffer)[]
  videos: string[]
  timeout: NodeJS.Timeout | undefined
  responseTimeout: NodeJS.Timeout | undefined
  busy: boolean
}
