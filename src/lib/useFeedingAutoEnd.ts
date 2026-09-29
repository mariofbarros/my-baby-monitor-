import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { db } from './db'
import { autoEndFeedingIfOverLimit, getMaxFeedingMinutes } from './feedingLimit'

/**
 * Encerra a mamada em andamento quando ela atinge o tempo máximo configurado.
 * Agenda para o instante do limite e confere de novo sempre que o app volta
 * a ficar visível (no celular os timers param com o app em segundo plano).
 * Se o app for reaberto depois do limite, encerra logo ao carregar.
 */
export function useFeedingAutoEnd() {
  const startTime = useLiveQuery(async () => (await db.activeFeeding.get(1))?.startTime)
  const maxMinutes = useLiveQuery(() => getMaxFeedingMinutes(db))

  useEffect(() => {
    if (startTime == null || maxMinutes == null) return
    const check = () => {
      void autoEndFeedingIfOverLimit(db)
    }
    const timer = setTimeout(check, Math.max(0, startTime + maxMinutes * 60_000 - Date.now()))
    document.addEventListener('visibilitychange', check)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [startTime, maxMinutes])
}
