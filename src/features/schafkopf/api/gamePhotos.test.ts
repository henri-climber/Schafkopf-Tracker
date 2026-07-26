import { describe, expect, it } from 'vitest'
import { createGamePhotoPath } from './gamePhotos'

describe('createGamePhotoPath', () => {
  it('uses the table, slot, UUID, and JPEG extension', () => {
    expect(createGamePhotoPath(42, 'before', 'fixed-id')).toBe('42/before-fixed-id.jpg')
    expect(createGamePhotoPath(42, 'after', 'fixed-id')).toBe('42/after-fixed-id.jpg')
  })
})
