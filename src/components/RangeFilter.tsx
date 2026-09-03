import { useEffect, useRef } from 'react'
import { RANGE_OPTIONS, type RangeId } from '../lib/ranges'

export default function RangeFilter({
  value,
  onChange,
}: {
  value: RangeId
  onChange: (id: RangeId) => void
}) {
  const activeRef = useRef<HTMLButtonElement>(null)

  // Sem isto, um filtro lembrado que esteja fora da área visível da barra
  // fica escondido e parece que nenhum está selecionado.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [value])

  return (
    <div className="chip-row" role="group" aria-label="Filtrar período">
      {RANGE_OPTIONS.map((option) => {
        const isActive = value === option.id
        return (
          <button
            key={option.id}
            ref={isActive ? activeRef : undefined}
            type="button"
            className={`chip${isActive ? ' active' : ''}`}
            aria-pressed={isActive}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
