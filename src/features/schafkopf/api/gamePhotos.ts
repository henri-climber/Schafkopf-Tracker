import { supabase } from '@/shared/supabase/client'
import type { Database } from '@/shared/supabase/database.types'

export const GAME_PHOTOS_BUCKET = 'game-photos'
export type GamePhotoSlot = 'before' | 'after'
type TableUpdate = Database['public']['Tables']['Tables']['Update']
type PhotoPathColumn = 'before_photo_path' | 'after_photo_path'

const photoPathColumns: Record<GamePhotoSlot, PhotoPathColumn> = {
  before: 'before_photo_path',
  after: 'after_photo_path',
}

export function createGamePhotoPath(
  tableId: number,
  slot: GamePhotoSlot,
  uuid: string = crypto.randomUUID(),
): string {
  return `${tableId}/${slot}-${uuid}.jpg`
}

export function getGamePhotoUrl(path: string | null): string | null {
  if (!path) return null
  return supabase.storage.from(GAME_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl
}

export async function uploadGamePhoto(
  tableId: number,
  slot: GamePhotoSlot,
  photo: File,
): Promise<string> {
  const path = createGamePhotoPath(tableId, slot)
  const { error } = await supabase.storage.from(GAME_PHOTOS_BUCKET).upload(path, photo, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function deleteGamePhoto(path: string | null): Promise<void> {
  if (!path) return
  const { error } = await supabase.storage.from(GAME_PHOTOS_BUCKET).remove([path])
  if (error) throw error
}

async function updatePhotoPath(
  tableId: number,
  slot: GamePhotoSlot,
  path: string | null,
  extraPatch: TableUpdate = {},
): Promise<void> {
  const patch: TableUpdate = { ...extraPatch, [photoPathColumns[slot]]: path }
  const { error } = await supabase.from('Tables').update(patch).eq('id', tableId)
  if (error) throw error
}

export async function replaceGamePhoto(input: {
  tableId: number
  slot: GamePhotoSlot
  photo: File
  previousPath?: string | null
  extraPatch?: TableUpdate
}): Promise<string> {
  const path = await uploadGamePhoto(input.tableId, input.slot, input.photo)
  try {
    await updatePhotoPath(input.tableId, input.slot, path, input.extraPatch)
  } catch (error) {
    await deleteGamePhoto(path).catch((cleanupError) =>
      console.error('Failed to clean up an unused game photo:', cleanupError),
    )
    throw error
  }

  if (input.previousPath && input.previousPath !== path) {
    await deleteGamePhoto(input.previousPath).catch((cleanupError) =>
      console.error('Failed to remove the replaced game photo:', cleanupError),
    )
  }
  return path
}

export async function removeGamePhoto(
  tableId: number,
  slot: GamePhotoSlot,
  path: string,
): Promise<void> {
  await updatePhotoPath(tableId, slot, null)
  await deleteGamePhoto(path).catch((cleanupError) =>
    console.error('Failed to remove the cleared game photo:', cleanupError),
  )
}

export async function closeGameWithPhoto(input: {
  tableId: number
  photo: File
  previousPath?: string | null
}): Promise<string> {
  return replaceGamePhoto({
    tableId: input.tableId,
    slot: 'after',
    photo: input.photo,
    previousPath: input.previousPath,
    extraPatch: { is_open: false },
  })
}
