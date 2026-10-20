'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { parsePhoneNumberFromString, AsYouType } from 'libphonenumber-js'

/** Champs camelCase, identiques aux lignes SQL mappées côté serveur (lib/supabase/data.ts). */
type Phone = { id: string; rawPhone: string; normalizedPhone: string | null; e164: string | null; countryCode: string | null; isValid: boolean; isPrimary: boolean }
type Email = { id: string; email: string; isValid: boolean; isPrimary: boolean }
type Tag = { id: string; name: string; color: string }

export default function ContactDetail({ orgId: _orgId, contactId, phones, emails, tagList, currentTags }: {
  orgId: string
  contactId: string
  phones: Phone[]
  emails: Email[]
  tagList: Tag[]
  currentTags: { tag_id: string; tags: { name: string; color: string } | null }[]
}) {
  void _orgId
  const router = useRouter()
  const [phoneList, setPhoneList] = useState<Phone[]>(phones)
  const [emailList, setEmailList] = useState<Email[]>(emails)
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [attached, setAttached] = useState(new Set(currentTags.map(t => t.tag_id)))

  async function call(body: Record<string, unknown>) {
    const res = await fetch(`/api/contacts/${contactId}/phones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error ?? 'Opération impossible')
    }
  }

  function preview(phone: string) {
    if (!phone.trim()) return null
    const parsed = parsePhoneNumberFromString(phone, 'CM')
    if (!parsed) {
      const asYou = new AsYouType('CM').input(phone)
      return { normalized: asYou, valid: false }
    }
    return { normalized: parsed.formatInternational(), valid: parsed.isValid() }
  }

  async function addPhone() {
    if (!newPhone.trim()) return
    setBusy(true)
    try {
      await call({ action: 'add', phone: newPhone })
      setNewPhone('')
      router.refresh()
    } catch { /* affiché côté serveur ? Ici on garde simple */ }
    setBusy(false)
  }

  async function addEmail() {
    if (!newEmail.trim()) return
    setBusy(true)
    const res = await fetch(`/api/contacts/${contactId}/emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', email: newEmail.trim() }),
    })
    if (res.ok) {
      setNewEmail('')
      router.refresh()
    }
    setBusy(false)
  }

  async function removePhone(id: string) {
    await fetch(`/api/contacts/${contactId}/phones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', phoneId: id }),
    })
    router.refresh()
  }

  async function removeEmail(id: string) {
    await fetch(`/api/contacts/${contactId}/emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', emailId: id }),
    })
    router.refresh()
  }

  async function setPrimaryPhone(id: string) {
    await fetch(`/api/contacts/${contactId}/phones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'primary', phoneId: id }),
    })
    router.refresh()
  }

  async function toggleTag(tagId: string) {
    const res = await fetch(`/api/contacts/${contactId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId }),
    })
    if (res.ok) {
      const j = await res.json().catch(() => ({}))
      setAttached(prev => {
        const next = new Set(prev)
        if (j.attached === false) next.delete(tagId)
        else next.add(tagId)
        return next
      })
      router.refresh()
    }
  }

  return (
    <div className="glass-card space-y-4">
      <div>
        <h3 className="font-bold mb-2">Téléphones</h3>
        <ul className="space-y-1.5">
          {phoneList.map(p => {
            const pv = preview(p.rawPhone)
            return (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.isValid ? 'var(--success)' : 'var(--danger)' }} />
                <span>{p.normalizedPhone ?? p.rawPhone}</span>
                {p.isPrimary && <span className="badge badge-blue">Principal</span>}
                {!p.isValid && pv && <span className="text-xs text-[color:var(--danger)]">invalide</span>}
                <button onClick={() => setPrimaryPhone(p.id)} className="ml-auto text-xs text-[color:var(--text-muted)] hover:text-[color:var(--brand-deep)]">Définir principal</button>
                <button onClick={() => removePhone(p.id)} className="text-xs text-[color:var(--text-muted)] hover:text-[color:var(--danger)]">×</button>
              </li>
            )
          })}
          {phoneList.length === 0 && <li className="text-sm text-[color:var(--text-muted)]">Aucun numéro</li>}
        </ul>
        <div className="mt-2 flex gap-2">
          <input className="input" value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
            placeholder="+237 6 70 12 34 56" />
          <button onClick={addPhone} disabled={busy} className="btn btn-ghost text-xs">Ajouter</button>
        </div>
        {preview(newPhone) && (
          <p className="text-xs text-[color:var(--text-secondary)] mt-1">
            Normalisé : {preview(newPhone)!.normalized} {preview(newPhone)!.valid ? '✓ valide' : '⚠ invalide'}
          </p>
        )}
      </div>

      <div>
        <h3 className="font-bold mb-2">Emails</h3>
        <ul className="space-y-1.5">
          {emailList.map(e => (
            <li key={e.id} className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full shrink-0 ${e.isValid ? 'bg-green-500' : 'bg-red-400'}`} />
              <span>{e.email}</span>
              {e.isPrimary && <span className="badge badge-blue">Principal</span>}
              <button onClick={() => removeEmail(e.id)} className="ml-auto text-xs text-[color:var(--text-muted)] hover:text-[color:var(--danger)]">×</button>
            </li>
          ))}
          {emailList.length === 0 && <li className="text-sm text-[color:var(--text-muted)]">Aucun email</li>}
        </ul>
        <div className="mt-2 flex gap-2">
          <input className="input" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
            placeholder="nom@entreprise.com" />
          <button onClick={addEmail} disabled={busy} className="btn btn-ghost text-xs">Ajouter</button>
        </div>
      </div>

      <div>
        <h3 className="font-bold mb-2">Tags</h3>
        <div className="flex flex-wrap gap-1.5">
          {tagList.map(t => (
            <button key={t.id} onClick={() => toggleTag(t.id)}
              className={`badge ${attached.has(t.id) ? 'badge-green' : ''}`}
              style={attached.has(t.id) ? { background: t.color + '22', color: t.color } : undefined}>
              {t.name}
            </button>
          ))}
          {tagList.length === 0 && <span className="text-sm text-[color:var(--text-muted)]">Créez des tags dans la section Tags</span>}
        </div>
      </div>
    </div>
  )
}
