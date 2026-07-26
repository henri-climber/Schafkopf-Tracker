import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/supabase/client', () => ({ supabase: {} }))

import { createGamePhotoPath } from './gamePhotos'

describe('createGamePhotoPath', () => {
  it('uses the table, slot, UUID, and JPEG extension', () => {
    expect(createGamePhotoPath(42, 'before', 'fixed-id')).toBe('42/before-fixed-id.jpg')
    expect(createGamePhotoPath(42, 'after', 'fixed-id')).toBe('42/after-fixed-id.jpg')
  })
})
