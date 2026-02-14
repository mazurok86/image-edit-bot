import { containsCyrillic } from '../helpers/stringHelpers.js'
import type { YandexTranslateResponse } from '../types/yandexTranslateResponse.js'

export class YandexTranslateService {
  private folderId: string
  private apiKey: string

  constructor(folderId: string, apiKey: string) {
    this.folderId = folderId
    this.apiKey = apiKey
  }

  public async translate(text: string): Promise<string> {
    if (text === '' || !containsCyrillic(text)) {
      return text
    }
    try {
      const res = await fetch('https://translate.api.cloud.yandex.net/translate/v2/translate', {
        method: 'POST',
        headers: {
          Authorization: `Api-Key ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folderId: this.folderId,
          texts: [text],
          sourceLanguageCode: 'ru',
          targetLanguageCode: 'en',
        }),
      })
      console.log(res)
      if (!res.ok) {
        throw new Error(`Translation error: ${res.status} ${res.statusText}`)
      }

      const responseData = (await res.json()) as YandexTranslateResponse
      const translations = responseData.translations
      if (translations === undefined) {
        throw new Error('Empty response from Yandex Translate API')
      }

      const translation = translations[0]
      if (translation === undefined) {
        throw new Error('Empty translation from Yandex Translate API')
      }

      return translation.text
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('Translation error:', err.message)
      } else {
        console.error('Unknown translation error')
      }
      throw err
    }
  }
}
