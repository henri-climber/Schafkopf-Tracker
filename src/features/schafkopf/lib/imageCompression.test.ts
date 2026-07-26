import { describe, expect, it, vi } from 'vitest'
import {
  compressGamePhoto,
  containedDimensions,
  MAX_GAME_PHOTO_BYTES,
  type GamePhotoRenderer,
} from './imageCompression'

function fakeRenderer(width: number, height: number, sizeFor: (quality: number) => number) {
  const render = vi.fn(
    async (_image, _width: number, _height: number, quality: number) =>
      new Blob([new Uint8Array(sizeFor(quality))], { type: 'image/jpeg' }),
  )
  const renderer: GamePhotoRenderer = {
    decode: vi.fn(async () => ({ width, height })),
    render,
  }
  return { renderer, render }
}

describe('containedDimensions', () => {
  it('downscales landscape and portrait images without changing their aspect ratio', () => {
    expect(containedDimensions(4000, 2000, 1920)).toEqual({ width: 1920, height: 960 })
    expect(containedDimensions(2000, 4000, 1920)).toEqual({ width: 960, height: 1920 })
  })

  it('does not upscale small images', () => {
    expect(containedDimensions(640, 480, 1920)).toEqual({ width: 640, height: 480 })
  })
})

describe('compressGamePhoto', () => {
  it('returns a JPEG below the configured size ceiling', async () => {
    const { renderer, render } = fakeRenderer(4000, 3000, (quality) =>
      quality > 0.7 ? MAX_GAME_PHOTO_BYTES + 1 : 420_000,
    )
    const source = new File([new Uint8Array(100)], 'occasion.png', { type: 'image/png' })

    const result = await compressGamePhoto(source, { renderer })

    expect(result.type).toBe('image/jpeg')
    expect(result.name).toBe('occasion.jpg')
    expect(result.size).toBeLessThanOrEqual(MAX_GAME_PHOTO_BYTES)
    expect(render.mock.calls[0]?.slice(1, 3)).toEqual([1920, 1440])
    expect(render).toHaveBeenCalledTimes(4)
  })

  it('rejects non-image and undecodable inputs', async () => {
    const textFile = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    await expect(compressGamePhoto(textFile)).rejects.toThrow('Please choose an image file.')

    const renderer: GamePhotoRenderer = {
      decode: vi.fn(async () => {
        throw new Error('decode failed')
      }),
      render: vi.fn(),
    }
    const invalidImage = new File(['broken'], 'broken.jpg', { type: 'image/jpeg' })
    await expect(compressGamePhoto(invalidImage, { renderer })).rejects.toThrow('decode failed')
  })
})
