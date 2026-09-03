import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db } from '../lib/db'
import type { DiaperType, Side } from '../lib/types'
import { ageLabel, todayIso } from '../lib/time'

type ImportResult = { ok: boolean; message: string }

const FEEDING_SIDES: Side[] = ['left', 'right']
const DIAPER_TYPES: DiaperType[] = ['pee', 'poop', 'both']

export default function Settings() {
  const profile = useLiveQuery(() => db.profile.get(1))
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [saved, setSaved] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile) {
      setName(profile.name)
      setBirthDate(profile.birthDate)
    }
  }, [profile])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    await db.profile.put({ id: 1, name: name.trim() || 'Bebê', birthDate: birthDate || todayIso() })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  async function handleExport() {
    const [feedings, diapers, measurements] = await Promise.all([
      db.feedings.toArray(),
      db.diapers.toArray(),
      db.measurements.toArray(),
    ])
    const data = { profile, feedings, diapers, measurements, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `baby-monitor-backup-${todayIso()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite selecionar o mesmo arquivo de novo depois
    if (!file) return

    setImportResult(null)
    setImporting(true)
    try {
      const parsed = JSON.parse(await file.text())
      if (!parsed || typeof parsed !== 'object') throw new Error('formato inválido')

      const feedings = (Array.isArray(parsed.feedings) ? parsed.feedings : []).filter(
        (f: unknown): f is { side: Side; startTime: number; endTime: number; durationSeconds: number } =>
          !!f &&
          typeof f === 'object' &&
          FEEDING_SIDES.includes((f as { side?: unknown }).side as Side) &&
          typeof (f as { startTime?: unknown }).startTime === 'number' &&
          typeof (f as { endTime?: unknown }).endTime === 'number' &&
          typeof (f as { durationSeconds?: unknown }).durationSeconds === 'number',
      )
      const diapers = (Array.isArray(parsed.diapers) ? parsed.diapers : []).filter(
        (d: unknown): d is { type: DiaperType; timestamp: number } =>
          !!d &&
          typeof d === 'object' &&
          DIAPER_TYPES.includes((d as { type?: unknown }).type as DiaperType) &&
          typeof (d as { timestamp?: unknown }).timestamp === 'number',
      )
      const measurements = (Array.isArray(parsed.measurements) ? parsed.measurements : []).filter(
        (m: unknown): m is { date: string; weightGrams?: number; heightCm?: number } =>
          !!m && typeof m === 'object' && typeof (m as { date?: unknown }).date === 'string',
      )
      const importedProfile =
        parsed.profile && typeof parsed.profile === 'object' && typeof parsed.profile.name === 'string'
          ? parsed.profile
          : null

      if (feedings.length === 0 && diapers.length === 0 && measurements.length === 0 && !importedProfile) {
        throw new Error('nenhum dado reconhecível')
      }

      const confirmed = window.confirm(
        `Importar ${feedings.length} mamada(s), ${diapers.length} fralda(s) e ${measurements.length} medição(ões)?\n\n` +
          'Os registros serão somados aos que já existem neste dispositivo — nada é apagado ou sobrescrito.',
      )
      if (!confirmed) {
        setImporting(false)
        return
      }

      await db.transaction('rw', db.feedings, db.diapers, db.measurements, db.profile, async () => {
        for (const f of feedings) {
          await db.feedings.add({ side: f.side, startTime: f.startTime, endTime: f.endTime, durationSeconds: f.durationSeconds })
        }
        for (const d of diapers) {
          await db.diapers.add({ type: d.type, timestamp: d.timestamp })
        }
        for (const m of measurements) {
          await db.measurements.add({
            date: m.date,
            weightGrams: typeof m.weightGrams === 'number' ? m.weightGrams : undefined,
            heightCm: typeof m.heightCm === 'number' ? m.heightCm : undefined,
          })
        }
        // Só adota o perfil do arquivo se este dispositivo ainda não tiver um configurado.
        const existingProfile = await db.profile.get(1)
        if (!existingProfile && importedProfile) {
          await db.profile.put({
            id: 1,
            name: importedProfile.name,
            birthDate: typeof importedProfile.birthDate === 'string' ? importedProfile.birthDate : todayIso(),
          })
        }
      })

      setImportResult({
        ok: true,
        message: `Importado: ${feedings.length} mamada(s), ${diapers.length} fralda(s), ${measurements.length} medição(ões).`,
      })
    } catch (err) {
      console.error('Falha ao importar backup', err)
      setImportResult({ ok: false, message: 'Não foi possível importar. Verifique se o arquivo é um backup válido.' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <header className="app-header">
        <h1 style={{ fontSize: 22 }}>Dados do bebê</h1>
      </header>
      <div className="page">
        <form className="card" onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label htmlFor="name">Nome</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do bebê" />
          </div>
          <div>
            <label htmlFor="birthDate">Data de nascimento</label>
            <input id="birthDate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          {birthDate && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Idade: {ageLabel(birthDate)}</p>}
          <button type="submit" className="btn btn-primary">
            {saved ? 'Salvo ✓' : 'Salvar'}
          </button>
        </form>

        <p className="section-title">Backup</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" className="btn btn-outline" style={{ width: '100%' }} onClick={handleExport}>
            Exportar dados (JSON)
          </button>
          <button
            type="button"
            className="btn btn-outline"
            style={{ width: '100%' }}
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {importing ? 'Importando…' : 'Importar dados (JSON)'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />
        </div>

        {importResult && (
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: importResult.ok ? 'var(--success)' : 'var(--danger)',
              marginTop: 10,
            }}
          >
            {importResult.message}
          </p>
        )}

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
          Todos os dados ficam salvos apenas neste dispositivo/navegador. A importação soma os registros do
          arquivo aos que já existem aqui — nada é apagado ou sobrescrito.
        </p>
      </div>
    </div>
  )
}
