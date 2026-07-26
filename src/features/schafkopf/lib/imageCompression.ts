export const MAX_GAME_PHOTO_BYTES = 500 * 1024
export const MAX_GAME_PHOTO_EDGE = 1920

export interface DecodedGamePhoto {
  width: number
  height: number
  source?: CanvasImageSource
  dispose?: () => void
}

export interface GamePhotoRenderer {
  decode(file: File): Promise<DecodedGamePhoto>
  render(image: DecodedGamePhoto, width: number, height: number, quality: number): Promise<Blob>
}

export interface CompressGamePhotoOptions {
  maxBytes?: number
  maxEdge?: number
  renderer?: GamePhotoRenderer
}

export function containedDimensions(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) throw new Error('The selected image has invalid dimensions.')

  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function decodeInBrowser(file: File): Promise<DecodedGamePhoto> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return {
        width: bitmap.width,
        height: bitmap.height,
        source: bitmap,
        dispose: () => bitmap.close(),
      }
    } catch {
      // Safari can decode some camera formats through <img> but not createImageBitmap.
    }
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = objectUrl
    await image.decode()
    return { width: image.naturalWidth, height: image.naturalHeight, source: image }
  } catch {
    throw new Error('This image format could not be read. Please choose a JPEG or PNG photo.')
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function renderInBrowser(
  image: DecodedGamePhoto,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  if (!image.source) throw new Error('The selected image could not be rendered.')

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Image compression is not supported by this browser.')

  // JPEG has no transparency. A white base avoids black backgrounds for PNGs.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image.source, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('The browser could not compress the selected photo.')),
      'image/jpeg',
      quality,
    )
  })
}

const browserRenderer: GamePhotoRenderer = {
  decode: decodeInBrowser,
  render: renderInBrowser,
}

export async function compressGamePhoto(
  file: File,
  options: CompressGamePhotoOptions = {},
): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')

  const maxBytes = options.maxBytes ?? MAX_GAME_PHOTO_BYTES
  const maxEdge = options.maxEdge ?? MAX_GAME_PHOTO_EDGE
  const renderer = options.renderer ?? browserRenderer
  const decoded = await renderer.decode(file)

  try {
    let dimensions = containedDimensions(decoded.width, decoded.height, maxEdge)
    let quality = 0.88

    for (let attempt = 0; attempt < 16; attempt += 1) {
      const blob = await renderer.render(decoded, dimensions.width, dimensions.height, quality)
      if (blob.size <= maxBytes) {
        const baseName = file.name.replace(/\.[^.]+$/, '') || 'game-photo'
        return new File([blob], `${baseName}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        })
      }

      if (quality > 0.56) {
        quality = Math.max(0.56, quality - 0.08)
      } else {
        const nextMaxEdge = Math.max(
          320,
          Math.round(Math.max(dimensions.width, dimensions.height) * 0.82),
        )
        dimensions = containedDimensions(dimensions.width, dimensions.height, nextMaxEdge)
        quality = 0.8
      }
    }

    throw new Error('The photo could not be reduced below 500 KB. Please choose another image.')
  } finally {
    decoded.dispose?.()
  }
}
