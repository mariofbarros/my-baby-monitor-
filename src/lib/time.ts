export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Duração compacta para resumos: "2h 15min", "45min", "30s". */
export function formatDurationLabel(totalSeconds: number): string {
  if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`
  const minutes = Math.round(totalSeconds / 60)
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  // A partir de três dígitos os minutos não cabem numa coluna do resumo,
  // e num total dessa ordem eles não acrescentam nada.
  if (h >= 100) return `${h}h`
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export function formatTimeAgo(epochMs: number): string {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - epochMs) / 1000))
  if (diffSeconds < 60) return 'agora mesmo'
  const minutes = Math.floor(diffSeconds / 60)
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remMinutes = minutes % 60
  if (hours < 24) {
    return remMinutes > 0 ? `há ${hours}h ${remMinutes}min` : `há ${hours}h`
  }
  const days = Math.floor(hours / 24)
  return `há ${days} dia${days > 1 ? 's' : ''}`
}

export function formatClock(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateShort(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

export function todayIso(): string {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

export function ageLabel(birthDateIso: string): string {
  const birth = new Date(birthDateIso + 'T00:00:00')
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - birth.getTime()) / 86_400_000)
  if (diffDays < 0) return ''
  if (diffDays < 60) return `${diffDays} dia${diffDays === 1 ? '' : 's'}`
  const weeks = Math.floor(diffDays / 7)
  if (diffDays < 90) return `${weeks} semanas`
  const months = Math.floor(diffDays / 30.44)
  if (months < 24) return `${months} meses`
  const years = Math.floor(months / 12)
  return `${years} ano${years === 1 ? '' : 's'}`
}
