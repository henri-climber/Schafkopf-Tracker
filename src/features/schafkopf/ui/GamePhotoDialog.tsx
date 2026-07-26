import { XMarkIcon } from '@heroicons/react/24/outline'
import { GamePhotoPicker } from './GamePhotoPicker'

interface GamePhotoDialogProps {
  title: string
  description: string
  pickerTitle: string
  file: File | null
  onFileChange: (file: File | null) => void
  existingUrl?: string | null
  primaryLabel: string
  onPrimary: () => void
  onClose: () => void
  secondaryLabel?: string
  onSecondary?: () => void
  onRemove?: () => void
  busy?: boolean
  error?: string | null
  primaryDisabled?: boolean
}

export function GamePhotoDialog({
  title,
  description,
  pickerTitle,
  file,
  onFileChange,
  existingUrl = null,
  primaryLabel,
  onPrimary,
  onClose,
  secondaryLabel,
  onSecondary,
  onRemove,
  busy = false,
  error = null,
  primaryDisabled = false,
}: GamePhotoDialogProps) {
  return (
    <div className="game-photo-dialog-overlay" role="presentation">
      <div
        className="game-photo-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-title"
      >
        <div className="game-photo-dialog-header">
          <div>
            <h2 id="photo-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button
            type="button"
            className="game-photo-dialog-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close photo dialog"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="game-photo-dialog-body">
          <GamePhotoPicker
            title={pickerTitle}
            file={file}
            onFileChange={onFileChange}
            existingUrl={existingUrl}
            disabled={busy}
          />
          {error && <p className="game-photo-dialog-error">{error}</p>}
        </div>

        <div className="game-photo-dialog-footer">
          {onRemove && (
            <button
              type="button"
              className="game-photo-dialog-button danger"
              onClick={onRemove}
              disabled={busy}
            >
              Remove photo
            </button>
          )}
          <button
            type="button"
            className="game-photo-dialog-button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          {onSecondary && secondaryLabel && (
            <button
              type="button"
              className="game-photo-dialog-button"
              onClick={onSecondary}
              disabled={busy}
            >
              {secondaryLabel}
            </button>
          )}
          <button
            type="button"
            className="game-photo-dialog-button game-photo-dialog-primary"
            onClick={onPrimary}
            disabled={busy || primaryDisabled}
          >
            {busy ? 'Saving…' : primaryLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
