export function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')
}

export function containsCyrillic(text: string): boolean {
  return /\p{Script=Cyrillic}/u.test(text)
}
