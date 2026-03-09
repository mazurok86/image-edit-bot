import type { BotContext } from '../botContext.js'

export abstract class Handler {
  constructor(protected readonly ctx: BotContext) {}
}
