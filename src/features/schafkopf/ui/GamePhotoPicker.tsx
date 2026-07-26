import { useEffect, useRef, useState } from 'react'
import { CameraIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { compressGamePhoto } from '@/features/schafkopf/lib/imageCompression'
import '@/shared/styles/game-photos.css'

interface GamePhotoPickerProps {
  title: string
  file: File | null
  onFileChange: (file: File | null) => void
  existingUrl?: string | null
  disabled?: boolean
  compact?: boolean
}

export function GamePhotoPicker({
  title,
  file,
  onFileChange,
  existingUrl = null,
  disabled = false,
  compact = false,
}: GamePhotoPickerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const nextUrl = URL.createObjectURL(file)
    setPreviewUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [file])

  async function handleSelectedFile(selected: File | undefined) {
    if (!selected) return
    setError(null)
    setIsProcessing(true)
    try {
      onFileChange(await compressGamePhoto(selected))
    } catch (selectionError) {
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : 'The photo could not be prepared.',
      )
    } finally {
      setIsProcessing(false)
      if (cameraInputRef.current) cameraInputRef.current.value = ''
      if (galleryInputRef.current) galleryInputRef.current.value = ''
    }
  }

  const visibleUrl = previewUrl ?? existingUrl

  return (
    <section className={`game-photo-picker${compact ? ' game-photo-picker-compact' : ''}`}>
      <div className="game-photo-picker-heading">
        <div>
          <h3>{title}</h3>
          <p>Optional · compressed to at most 500 KB</p>
        </div>
        {file && (
          <button
            type="button"
            onClick={() => onFileChange(null)}
            className="game-photo-clear"
            disabled={disabled || isProcessing}
            aria-label="Clear selected photo"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {visibleUrl ? (
        <img src={visibleUrl} alt={`${title} preview`} className="game-photo-preview" />
      ) : (
        <div className="game-photo-placeholder">
          <PhotoIcon className="w-8 h-8" />
          <span>Add a photo of the group or occasion</span>
        </div>
      )}

      <div className="game-photo-actions">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={disabled || isProcessing}
          className="game-photo-action"
        >
          <CameraIcon className="w-5 h-5" />
          {isProcessing ? 'Preparing…' : 'Take photo'}
        </button>
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={disabled || isProcessing}
          className="game-photo-action"
        >
          <PhotoIcon className="w-5 h-5" />
          Choose photo
        </button>
      </div>

      <p className="game-photo-library-note">
        Want to keep the full-resolution original? Take it in your Camera app, then choose it here.
      </p>
      {error && <p className="game-photo-error">{error}</p>}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => handleSelectedFile(event.target.files?.[0])}
        tabIndex={-1}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => handleSelectedFile(event.target.files?.[0])}
        tabIndex={-1}
      />
    </section>
  )
}
