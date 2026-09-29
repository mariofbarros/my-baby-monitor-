import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db } from '../lib/db'
import { applyBackup, buildBackup, parseBackup, type ImportMode, type ParsedBackup } from '../lib/backup'
import { ageLabel, todayIso } from '../lib/time'

type ImportResult = { ok: boolean; message: string }

export default function Settings() {
  const profile = useLiveQuery(() => db.profile.get(1))
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [saved, setSaved] = useState(false)
  const [importing, setImporting] = useState(false)
  const [pendingImport, setPendingImport] = useState<ParsedBackup | null>(null)
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
    const data = await buildBackup(db)
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
      setPendingImport(parseBackup(JSON.parse(await file.text())))
    } catch (err) {
      console.error('Falha ao ler arquivo de backup', err)
      setImportResult({ ok: false, message: 'Não foi possível importar. Verifique se o arquivo é um backup válido.' })
    }
  }

  async function runImport(mode: ImportMode) {
    if (!pendingImport) return

    if (mode === 'replace') {
      const confirmed = window.confirm(
        'Isso vai apagar TODOS os dados atuais deste dispositivo (mamadas, fraldas, medições, checklist e perfil) ' +
          'e substituir pelos do arquivo importado.\n\nEssa ação não pode ser desfeita. Continuar?',
      )
      if (!confirmed) return
    }

    setImporting(true)
    const { feedings, diapers, measurements, checklistItems } = pendingImport
    try {
      await applyBackup(db, pendingImport, mode)

      setImportResult({
        ok: true,
        message:
          (mode === 'replace' ? 'Base substituída: ' : 'Importado: ') +
          `${feedings.length} mamada(s), ${diapers.length} fralda(s), ${measurements.length} medição(ões), ` +
          `${checklistItems.length} item(ns) do checklist.`,
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
              {pendingImport.feedings.length} mamada(s), {pendingImport.diapers.length} fralda(s),{' '}
              {pendingImport.measurements.length} medição(ões) e {pendingImport.checklistItems.length} item(ns) do
              checklist encontrados no arquivo.
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
