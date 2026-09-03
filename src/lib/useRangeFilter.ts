import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_RANGE, resolveRange, type RangeId, RANGE_OPTIONS } from './ranges'

function readStored(key: string): RangeId {
  try {
    const stored = localStorage.getItem(key)
    if (stored && RANGE_OPTIONS.some((o) => o.id === stored)) return stored as RangeId
  } catch {
    // localStorage pode estar bloqueado (aba anônima, etc.)
  }
  return DEFAULT_RANGE
}

/** Filtro de período que lembra a última escolha da tela. */
export function useRangeFilter(storageKey: string) {
  const [rangeId, setRangeId] = useState<RangeId>(() => readStored(storageKey))

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, rangeId)
    } catch {
      // sem persistência, o filtro continua funcionando na sessão
    }
  }, [storageKey, rangeId])

  const range = useMemo(() => resolveRange(rangeId), [rangeId])

  return { rangeId, setRangeId, range }
}
