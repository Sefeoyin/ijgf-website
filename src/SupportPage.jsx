import { useState } from 'react'

const CATEGORIES = [
  'Challenge Rules',
  'Funded Account',
  'Payouts & Withdrawals',
  'Trading Issues',
  'Technical / Platform',
  'KYC & Verification',
  'Billing',
  'Other',
]

const MOCK_TICKETS = [
  { id: 'TIC 001', subject: 'Issue with wallet funding and trading challenge', status: 'Pending', updatedAt: '16/02/2026  12:34pm' },
]

const STATUS_COLOR = { Pending: '#f59e0b', Open: '#4ade80', Resolved: 'rgba(255,255,255,0.4)', Closed: 'rgba(255,255,255,0.3)' }

export default function SupportPage() {
  const [subject,     setSubject]     = useState('')
  const [category,    setCategory]    = useState('')
  const [description, setDescription] = useState('')
  const [submitted,   setSubmitted]   = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [tickets,     setTickets]     = useState(MOCK_TICKETS)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!subject || !category || !description) return
    setSubmitting(true)
    try {
      const newTicket = {
        id: `TIC ${String(tickets.length + 1).padStart(3, '0')}`,
        subject,
        status: 'Pending',
        updatedAt: new Date().toLocaleString('en-GB', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }),
      }
      setTickets(prev => [newTicket, ...prev])
      setSubject('')
      setCategory('')
      setDescription('')
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 4000)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="support-page">

      {/* ── Contact cards ────────────────────────────────────────── */}
      <p className="support-tagline">Get help, report issues, or contact the team.</p>

      <div className="support-cards-grid">
        {/* Live Chat */}
        <div className="support-card">
          <div className="support-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div className="support-card-title">Live Chat</div>
          <div className="support-card-sub">We are here to help</div>
          <button className="support-card-link" onClick={() => window.open('https://discord.gg', '_blank')}>
            Click here to get started
          </button>
        </div>

        {/* Email */}
        <div className="support-card">
          <div className="support-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <div className="support-card-title">Email</div>
          <div className="support-card-sub">Send us an email</div>
          <a href="mailto:support@ijgf.com" className="support-card-link">support@ijgf.com</a>
        </div>

        {/* Report an issue */}
        <div className="support-card">
          <div className="support-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div className="support-card-title">Report an issue</div>
          <div className="support-card-sub">Mon-Fri 8am - 10pm</div>
          <div className="support-card-link">00323415</div>
        </div>

        {/* System Status */}
        <div className="support-card">
          <div className="support-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <div className="support-card-title">System Status</div>
          <div className="support-card-sub">Platform uptime &amp; incidents</div>
          <div className="support-card-status">
            <span className="support-status-dot" />
            Operational
          </div>
        </div>
      </div>

      <div className="support-divider" />

      {/* ── Ticket form ──────────────────────────────────────────── */}
      <div className="support-section-title">Submit a Support Ticket</div>

      {submitted && (
        <div className="support-success">
          ✓ Your ticket has been submitted. We'll get back to you shortly.
        </div>
      )}

      <form className="support-form" onSubmit={handleSubmit}>
        <div className="support-form-row">
          <div className="support-field">
            <label className="support-label">Subject</label>
            <input
              className="support-input"
              placeholder="Describe your subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              required
            />
          </div>
          <div className="support-field">
            <label className="support-label">Category</label>
            <div className="support-select-wrap">
              <select
                className="support-select"
                value={category}
                onChange={e => setCategory(e.target.value)}
                required
              >
                <option value="" disabled>Select a category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <svg className="support-select-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="support-field">
          <label className="support-label">Description</label>
          <textarea
            className="support-textarea"
            placeholder="Describe your issue"
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
            rows={6}
          />
        </div>

        <button type="submit" className="support-submit-btn" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Ticket'}
        </button>
      </form>

      <div className="support-divider" />

      {/* ── Open Tickets ─────────────────────────────────────────── */}
      <div className="support-section-title">Open Tickets</div>

      <div className="support-table-wrap">
        <table className="support-table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={4} className="support-table-empty">No open tickets</td>
              </tr>
            ) : (
              tickets.map(t => (
                <tr key={t.id}>
                  <td className="support-ticket-id">{t.id}</td>
                  <td>{t.subject}</td>
                  <td>
                    <span style={{ color: STATUS_COLOR[t.status] || '#e2e8f0' }}>
                      {t.status}
                    </span>
                  </td>
                  <td className="support-ticket-date">{t.updatedAt}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}
