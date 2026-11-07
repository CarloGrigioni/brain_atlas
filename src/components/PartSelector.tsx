import { useEffect, useRef } from 'react'
import { ANATOMY_COLORS } from '../anatomyColors'
import type { PartId } from '../anatomyColors'

interface PartSelectorProps {
  selected: PartId[]
  disabled: boolean
  onChange: (parts: PartId[]) => void
}

export function PartSelector({ selected, disabled, onChange }: PartSelectorProps) {
  const details = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (details.current && !details.current.contains(event.target as Node)) details.current.open = false
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])
  const summary = selected.length === ANATOMY_COLORS.length ? 'Tutte le parti'
    : selected.length === 0 ? 'Nessuna parte'
    : selected.length === 1 ? ANATOMY_COLORS.find((part) => part.id === selected[0])!.label
    : `${selected.length} parti selezionate`

  return <div className="part-control">
    <span id="parts-label">Parti da visualizzare</span>
    <details ref={details} className="part-selector" onKeyDown={(event) => {
      if (event.key === 'Escape' && details.current) {
        details.current.open = false
        details.current.querySelector('summary')?.focus()
        event.stopPropagation()
      }
    }} onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && details.current) details.current.open = false
    }}>
      <summary aria-label={`Parti da visualizzare: ${summary}`} aria-disabled={disabled}
        onClick={(event) => { if (disabled) event.preventDefault() }}>{summary}</summary>
      <fieldset className="part-options" disabled={disabled}>
        <legend className="sr-only">Parti anatomiche</legend>
        <div className="part-selection-actions">
          <button type="button" onClick={() => onChange(ANATOMY_COLORS.map((part) => part.id))}>Seleziona tutte</button>
          <button type="button" onClick={() => onChange([])}>Deseleziona tutte</button>
        </div>
        {ANATOMY_COLORS.map((part) => <label key={part.id}>
          <input type="checkbox" checked={selected.includes(part.id)} onChange={(event) =>
            onChange(event.target.checked ? [...selected, part.id] : selected.filter((id) => id !== part.id))} />
          <span className="part-swatch" style={{ backgroundColor: part.color }} aria-hidden="true" />
          <span>{part.label}</span>
        </label>)}
      </fieldset>
    </details>
  </div>
}
