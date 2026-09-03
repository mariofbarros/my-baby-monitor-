import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../lib/db'
import { ageLabel, todayIso } from '../lib/time'

export default function Settings() {
  const profile = useLiveQuery(() => db.profile.get(1))
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [saved, setSaved] = useState(false)

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
        <button type="button" className="btn btn-outline" style={{ width: '100%' }} onClick={handleExport}>
          Exportar dados (JSON)
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
          Todos os dados ficam salvos apenas neste dispositivo/navegador.
        </p>
      </div>
    </div>
  )
}
