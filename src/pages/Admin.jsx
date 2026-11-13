import { useEffect, useState, useCallback } from 'react'
import { supabase, isConfigured, TABLE } from '../lib/supabase'
import { KRAJE, CATEGORIES, FAMILY_POLICY } from '../lib/constants'

export default function Admin() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!isConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!isConfigured) {
    return <div className="notice">Admin vyžaduje nastavené připojení k Supabase (VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY).</div>
  }

  async function sendLink(e) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    })
    if (error) alert(error.message)
    else setSent(true)
  }

  if (!session) {
    return (
      <div className="login-box">
        <h2>Admin — přihlášení</h2>
        {sent ? (
          <p>Poslali jsme ti přihlašovací odkaz na <b>{email}</b>. Otevři ho na tomto zařízení.</p>
        ) : (
          <form onSubmit={sendLink}>
            <input type="email" required placeholder="tvůj@email.cz" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div style={{ marginTop: 12 }}>
              <button className="btn" type="submit">Poslat přihlašovací odkaz</button>
            </div>
          </form>
        )}
      </div>
    )
  }

  return <AdminTable session={session} />
}

function AdminTable({ session }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function setStatus(id, status) {
    const patch = { status }
    if (status === 'published') patch.verified_at = new Date().toISOString()
    const { error } = await supabase.from(TABLE).update(patch).eq('id', id)
    if (error) alert(error.message)
    else load()
  }

  async function remove(id) {
    if (!confirm('Opravdu smazat záznam?')) return
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) alert(error.message)
    else load()
  }

  if (error) return <div className="notice">Chyba: {error} — zkontroluj, že máš přístup (RLS admin e-mail).</div>

  return (
    <div className="admin">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0' }}>
        <h2 style={{ margin: 0 }}>Admin — {rows.length} záznamů</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost" onClick={() => setEditing({})}>+ Nové místo</button>
          <button className="btn ghost" onClick={() => supabase.auth.signOut()}>Odhlásit ({session.user.email})</button>
        </div>
      </div>

      {editing && (
        <EditForm row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      )}

      {loading ? <p className="empty">Načítám…</p> : (
        <table>
          <thead>
            <tr><th>Název</th><th>Kraj</th><th>Vhodnost</th><th>Stav</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.kraj}</td>
                <td>{FAMILY_POLICY[r.family_policy]?.label || r.family_policy}</td>
                <td>{r.status}</td>
                <td className="row-actions">
                  {r.status !== 'published' && <button className="btn" onClick={() => setStatus(r.id, 'published')}>Publikovat</button>}
                  {r.status !== 'rejected' && <button className="btn ghost" onClick={() => setStatus(r.id, 'rejected')}>Zamítnout</button>}
                  <button className="btn ghost" onClick={() => setEditing(r)}>Upravit</button>
                  <button className="btn ghost" onClick={() => remove(r.id)}>Smazat</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function slugify(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function EditForm({ row, onClose, onSaved }) {
  const [f, setF] = useState({
    name: '', category: 'zoo', kraj: '', city: '', address: '', website: '',
    family_policy: 'none', max_children: '', kids_free_under_age: '',
    price_adult: '', price_child: '', price_family: '',
    family_ticket_desc: '', source_url: '', status: 'draft', ...row,
  })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function save(e) {
    e.preventDefault()
    const payload = {
      ...f,
      slug: f.slug || slugify(f.name),
      max_children: f.max_children === '' ? null : Number(f.max_children),
      kids_free_under_age: f.kids_free_under_age === '' ? null : Number(f.kids_free_under_age),
      price_adult: f.price_adult === '' ? null : Number(f.price_adult),
      price_child: f.price_child === '' ? null : Number(f.price_child),
      price_family: f.price_family === '' ? null : Number(f.price_family),
    }
    const { error } = row.id
      ? await supabase.from(TABLE).update(payload).eq('id', row.id)
      : await supabase.from(TABLE).insert(payload)
    if (error) alert(error.message)
    else onSaved()
  }

  return (
    <form className="detail" onSubmit={save} style={{ display: 'grid', gap: 10 }}>
      <input placeholder="Název" required value={f.name} onChange={set('name')} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <select value={f.category} onChange={set('category')}>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={f.kraj} onChange={set('kraj')}>
          <option value="">— kraj —</option>
          {KRAJE.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <input placeholder="Město" value={f.city} onChange={set('city')} />
        <input placeholder="Adresa" value={f.address} onChange={set('address')} />
      </div>
      <input placeholder="Web (https://…)" value={f.website} onChange={set('website')} />
      <select value={f.family_policy} onChange={set('family_policy')}>
        {Object.entries(FAMILY_POLICY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <input type="number" placeholder="Max. dětí" value={f.max_children ?? ''} onChange={set('max_children')} />
        <input type="number" placeholder="Děti zdarma do věku" value={f.kids_free_under_age ?? ''} onChange={set('kids_free_under_age')} />
        <input type="number" placeholder="Cena dospělý" value={f.price_adult ?? ''} onChange={set('price_adult')} />
        <input type="number" placeholder="Cena dítě" value={f.price_child ?? ''} onChange={set('price_child')} />
        <input type="number" placeholder="Cena rodinné" value={f.price_family ?? ''} onChange={set('price_family')} />
      </div>
      <textarea placeholder="Popis podmínek vstupného" rows={2} value={f.family_ticket_desc ?? ''} onChange={set('family_ticket_desc')} />
      <input placeholder="Zdroj (URL)" value={f.source_url ?? ''} onChange={set('source_url')} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" type="submit">Uložit</button>
        <button className="btn ghost" type="button" onClick={onClose}>Zrušit</button>
      </div>
    </form>
  )
}
