import type { FeedingMethod, Side } from './types'

export const FEEDING_METHODS: { id: FeedingMethod; label: string }[] = [
  { id: 'breast', label: 'Peito' },
  { id: 'bottle', label: 'Mamadeira' },
  { id: 'mixed', label: 'Misto' },
]

/** Cor de destaque da modalidade — mamadeira tem cor própria; peito/misto seguem o lado. */
export function feedingMethodColor(method: FeedingMethod, side?: Side): string {
  if (method === 'bottle') return 'var(--bottle)'
  return side === 'left' ? 'var(--left)' : 'var(--right)'
}

export function feedingMethodBg(method: FeedingMethod, side?: Side): string {
  if (method === 'bottle') return 'var(--bottle-bg)'
  return side === 'left' ? 'var(--left-bg)' : 'var(--right-bg)'
}

/** Rótulo completo, para o card grande de mamada em andamento. */
export function feedingMethodBadgeLabel(method: FeedingMethod, side?: Side): string {
  if (method === 'bottle') return 'Mamadeira'
  const sideLabel = side === 'left' ? 'esquerdo' : 'direito'
  return method === 'mixed' ? `Misto · peito ${sideLabel}` : `Peito ${sideLabel}`
}

/** Rótulo compacto, para cards de resumo (ex: "Última mamada"). */
export function feedingMethodShortLabel(method: FeedingMethod, side?: Side): string {
  if (method === 'bottle') return 'Mamadeira'
  const sideLabel = side === 'left' ? 'Esquerdo' : 'Direito'
  return method === 'mixed' ? `Misto · ${sideLabel}` : sideLabel
}

/** Tag de 3-5 letras, para o badge das linhas de histórico. */
export function feedingBadgeTag(method: FeedingMethod, side?: Side): string {
  if (method === 'bottle') return 'Mam'
  if (method === 'mixed') return 'Misto'
  return side === 'left' ? 'Esq' : 'Dir'
}
