import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db } from '../lib/db'
import type { DiaperType, Side } from '../lib/types'
import { ageLabel, todayIso } from '../lib/time'

type ImportResult = { ok: boolean; message: string }

type PendingImport = {
  feedings: { side: Side; startTime: number; endTime: number; durationSeconds: number }[]
  diapers: { type: DiaperType; timestamp: number }[]
  measurements: { date: string; weightGrams?: number; heightCm?: number }[]
  profile: { name: string; birthDate?: string } | null
}

type ImportMode = 'add' | 'replace'

const FEEDING_SIDES: Side[] = ['left', 'right']
const DIAPER_TYPES: DiaperType[] = ['pee', 'poop', 'both']

export default function Settings() {
  const profile = useLiveQuery(() => db.profile.get(1))
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [saved, setSaved] = useState(false)
  const [importing, setImporting] = useState(false)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
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
    try {
      const parsed = JSON.parse(await file.text())
      if (!parsed || typeof parsed !== 'object') throw new Error('formato inválido')

      const feedings = (Array.isArray(parsed.feedings) ? parsed.feedings : []).filter(
        (f: unknown): f is PendingImport['feedings'][number] =>
          !!f &&
          typeof f === 'object' &&
          FEEDING_SIDES.includes((f as { side?: unknown }).side as Side) &&
          typeof (f as { startTime?: unknown }).startTime === 'number' &&
          typeof (f as { endTime?: unknown }).endTime === 'number' &&
          typeof (f as { durationSeconds?: unknown }).durationSeconds === 'number',
      )
      const diapers = (Array.isArray(parsed.diapers) ? parsed.diapers : []).filter(
        (d: unknown): d is PendingImport['diapers'][number] =>
          !!d &&
          typeof d === 'object' &&
          DIAPER_TYPES.includes((d as { type?: unknown }).type as DiaperType) &&
          typeof (d as { timestamp?: unknown }).timestamp === 'number',
      )
      const measurements = (Array.isArray(parsed.measurements) ? parsed.measurements : []).filter(
        (m: unknown): m is PendingImport['measurements'][number] =>
          !!m && typeof m === 'object' && typeof (m as { date?: unknown }).date === 'string',
      )
      const importedProfile =
        parsed.profile && typeof parsed.profile === 'object' && typeof parsed.profile.name === 'string'
          ? { name: parsed.profile.name as string, birthDate: parsed.profile.birthDate as string | undefined }
          : null

      if (feedings.length === 0 && diapers.length === 0 && measurements.length === 0 && !importedProfile) {
        throw new Error('nenhum dado reconhecível')
      }

      setPendingImport({ feedings, diapers, measurements, profile: importedProfile })
    } catch (err) {
      console.error('Falha ao ler arquivo de backup', err)
      setImportResult({ ok: false, message: 'Não foi possível importar. Verifique se o arquivo é um backup válido.' })
    }
  }

  async function runImport(mode: ImportMode) {
    if (!pendingImport) return

    if (mode === 'replace') {
      const confirmed = window.confirm(
        'Isso vai apagar TODOS os dados atuais deste dispositivo (mamadas, fraldas, medições e perfil) ' +
          'e substituir pelos do arquivo importado.\n\nEssa ação não pode ser desfeita. Continuar?',
      )
      if (!confirmed) return
    }

    setImporting(true)
    const { feedings, diapers, measurements, profile: importedProfile } = pendingImport
    try {
      await db.transaction('rw', db.feedings, db.diapers, db.measurements, db.profile, async () => {
        if (mode === 'replace') {
          await Promise.all([db.feedings.clear(), db.diapers.clear(), db.measurements.clear(), db.profile.clear()])
        }
        for (const f of feedings) {
          await db.feedings.add({ side: f.side, startTime: f.startTime, endTime: f.endTime, durationSeconds: f.durationSeconds })
        }
        for (const d of diapers) {
          await db.diapers.add({ type: d.type, timestamp: d.timestamp })
        }
        for (const m of measurements) {
          await db.measurements.add({ date: m.date, weightGrams: m.weightGrams, heightCm: m.heightCm })
        }

        if (mode === 'replace') {
          if (importedProfile) {
            await db.profile.put({ id: 1, name: importedProfile.name, birthDate: importedProfile.birthDate || todayIso() })
          }
        } else {
          // Em "adicionar", só adota o perfil do arquivo se este dispositivo ainda não tiver um configurado.
          const existingProfile = await db.profile.get(1)
          if (!existingProfile && importedProfile) {
            await db.profile.put({ id: 1, name: importedProfile.name, birthDate: importedProfile.birthDate || todayIso() })
          }
        }
      })

      setImportResult({
        ok: true,
        message:
          (mode === 'replace' ? 'Base substituída: ' : 'Importado: ') +
          `${feedings.length} mamada(s), ${diapers.length} fralda(s), ${measurements.length} medição(ões).`,
      })
      setPendingImport(null)
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
            disabled={importing || !!pendingImport}
            onClick={() => fileInputRef.current?.click()}
          >
            Importar dados (JSON)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />
        </div>

        {pendingImport && (
          <div className="card" style={{ marginTop: 12 }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>Como importar?</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              {pendingImport.feedings.length} mamada(s), {pendingImport.diapers.length} fralda(s) e{' '}
              {pendingImport.measurements.length} medição(ões) encontradas no arquivo.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="button" className="btn btn-primary" disabled={importing} onClick={() => runImport('add')}>
                Adicionar aos existentes
              </button>
              <button type="button" className="btn btn-danger" disabled={importing} onClick={() => runImport('replace')}>
                Substituir tudo
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={importing}
                onClick={() => setPendingImport(null)}
              >
                Cancelar
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
              <strong>Adicionar</strong> soma os registros do arquivo aos que já existem aqui.{' '}
              <strong>Substituir</strong> apaga tudo o que está neste dispositivo antes de importar.
            </p>
          </div>
        )}

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
          Todos os dados ficam salvos apenas neste dispositivo/navegador.
        </p>
      </div>
    </div>
  )
}
