import Replicate from 'replicate'
import convert from 'heic-convert'
import { buffer } from 'node:stream/consumers'
import { ReplicateApiError } from '../errors/ReplicateApiError.js'
import type { FileOutput } from '../types/fileOutput.js'
import { getModel } from '../models/registry.js'
import type { ModelCapabilitiesValue } from '../types/model.js'

export class ReplicateService {
  private replicate: Replicate

  constructor(auth: string) {
    this.replicate = new Replicate({ auth })
  }

  private async run(...args: Parameters<typeof this.replicate.run>): ReturnType<typeof this.replicate.run> {
    try {
      return await this.replicate.run(...args)
    } catch (e) {
      if (e instanceof Error) {
        throw new ReplicateApiError(e.message)
      }
      throw e
    }
  }

  async uploadHeicImage(url: string): Promise<string> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    const output = await convert({
      buffer: Buffer.from(arrayBuffer) as unknown as ArrayBuffer,
      format: 'JPEG',
      quality: 1,
    })
    const file = await this.replicate.files.create(new Blob([output], { type: 'image/jpeg' }))
    return file.urls.get
  }

  async runFlux2(prompt: string, images: string[], options: ModelCapabilitiesValue<'flux2'>): Promise<FileOutput[]> {
    const input = {
      prompt,
      input_images: images,
      aspect_ratio: options.aspectRatio,
      output_format: 'jpg',
      output_quality: 90,
      resolution: '2 MP',
      safety_tolerance: 5,
    }
    const id = getModel('flux2').id

    const output = (await this.run(id, {
      input,
    })) as ReadableStream
    const buf = Buffer.from(await buffer(output))

    return [
      {
        buffer: buf,
        filename: `flux2_${Date.now()}.jpg`,
        contentType: 'image/jpeg',
      },
    ]
  }

  async runFlux(prompt: string, image: string | undefined, options: ModelCapabilitiesValue<'flux1'>): Promise<FileOutput[]> {
    const input = {
      prompt,
      input_image: image,
      aspect_ratio: options.aspectRatio,
      output_format: 'jpg',
      safety_tolerance: 2,
    }
    const id = getModel('flux1').id

    const output = (await this.run(id, {
      input,
    })) as ReadableStream
    const buf = Buffer.from(await buffer(output))

    return [
      {
        buffer: buf,
        filename: `flux_${Date.now()}.jpg`,
        contentType: 'image/jpeg',
      },
    ]
  }

  async runSeedream4(prompt: string, images: string[], options: ModelCapabilitiesValue<'seedream'>): Promise<FileOutput[]> {
    const input = {
      prompt,
      image_input: images,
      size: '4K',
      width: 2048,
      height: 2048,
      aspect_ratio: options.aspectRatio,
      enhance_prompt: true,
      sequential_image_generation: 'disabled',
    }
    const id = getModel('seedream').id

    const outputs = (await this.run(id, {
      input,
    })) as ReadableStream[]
    const result: FileOutput[] = []

    let i = 0
    for (const output of outputs) {
      i++
      const buf = Buffer.from(await buffer(output))
      result.push({
        buffer: buf,
        filename: `seedream_${Date.now()}_${i}.jpg`,
        contentType: 'image/jpeg',
      })
    }

    return result
  }

  async runNanoBananaPro(prompt: string, images: string[], options: ModelCapabilitiesValue<'nanoBanana'>): Promise<FileOutput[]> {
    const input = {
      prompt,
      resolution: '2K',
      image_input: images,
      aspect_ratio: options.aspectRatio,
      output_format: 'jpg',
      safety_filter_level: 'block_only_high',
    }
    const id = getModel('nanoBanana').id

    const output = (await this.run(id, {
      input,
    })) as ReadableStream
    const buf = Buffer.from(await buffer(output))

    return [
      {
        buffer: buf,
        filename: `banana_${Date.now()}.jpg`,
        contentType: 'image/jpeg',
      },
    ]
  }

  async runKling(prompt: string, image: string | undefined, options: ModelCapabilitiesValue<'kling'>): Promise<FileOutput[]> {
    const input = {
      prompt,
      start_image: image,
      mode: options.mode,
      duration: 5,
      negative_prompt: '',
    }
    const id = getModel('kling').id

    const output = (await this.run(id, {
      input,
    })) as ReadableStream
    const buf = Buffer.from(await buffer(output))

    return [
      {
        buffer: buf,
        filename: `kling_${Date.now()}.mp4`,
        contentType: 'video/mp4',
      },
    ]
  }

  async runKlingMotionControl(
    prompt: string,
    image: string | undefined,
    video: string | undefined,
    options: ModelCapabilitiesValue<'klingMC'>,
  ): Promise<FileOutput[]> {
    const input = {
      prompt,
      image,
      video,
      mode: 'pro',
      keep_original_sound: true,
      character_orientation: options.characterOrientation,
    }
    const id = getModel('klingMC').id

    const output = (await this.run(id, {
      input,
    })) as ReadableStream
    const buf = Buffer.from(await buffer(output))

    return [
      {
        buffer: buf,
        filename: `kling_mc_${Date.now()}.mp4`,
        contentType: 'video/mp4',
      },
    ]
  }
}
