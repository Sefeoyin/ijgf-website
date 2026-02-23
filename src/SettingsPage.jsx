import { useState } from 'react'

const TIMEZONES = ['WAT', 'UTC', 'EST', 'PST', 'CET', 'GST', 'SGT', 'AEST']
const CURRENCIES = ['US Dollars', 'Euro', 'British Pound', 'UAE Dirham']
const LANGUAGES  = [
  { label: 'English', flag: '🇬🇧' },
  { label: 'Arabic',  flag: '🇦🇪' },
  { label: 'French',  flag: '🇫🇷' },
]

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`settings-toggle ${checked ? 'on' : 'off'}`}
      aria-pressed={checked}
    >
      <span className="settings-toggle-thumb" />
    </button>
  )
}

function SettingsRow({ label, children }) {
  return (
    <div className="settings-row">
      <span className="settings-row-label">{label}</span>
      <div className="settings-row-value">{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const [language,       setLanguage]       = useState('English')
  const [currency,       setCurrency]       = useState('US Dollars')
  const [timezone,       setTimezone]       = useState('WAT')
  const [emailNotifs,    setEmailNotifs]    = useState(true)
  const [challengeAlerts,setChallengeAlerts]= useState(true)
  const [payoutConfirms, setPayoutConfirms] = useState(true)
  const [showDeactivate, setShowDeactivate] = useState(false)


  const currentLang = LANGUAGES.find(l => l.label === language)

  return (
    <div className="settings-page">

      {/* ── Account Settings ─────────────────────────────────────── */}
      <div className="settings-section-title">Account Settings</div>

      <div className="settings-card">
        <SettingsRow label="Language">
          <div className="settings-select-wrap">
            <select
              className="settings-select"
              value={language}
              onChange={e => setLanguage(e.target.value)}
            >
              {LANGUAGES.map(l => (
                <option key={l.label} value={l.label}>{l.flag} {l.label}</option>
              ))}
            </select>
            <span className="settings-flag">{currentLang?.flag}</span>
          </div>
        </SettingsRow>

        <div className="settings-card-divider" />

        <SettingsRow label="Currency">
          <div className="settings-select-wrap">
            <select
              className="settings-select"
              value={currency}
              onChange={e => setCurrency(e.target.value)}
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <svg className="settings-select-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </SettingsRow>

        <div className="settings-card-divider" />

        <SettingsRow label="Time Zone">
          <div className="settings-select-wrap">
            <select
              className="settings-select"
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
            >
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
            <svg className="settings-select-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </SettingsRow>
      </div>

      {/* ── Notification Settings ─────────────────────────────────── */}
      <div className="settings-section-title">Notification Settings</div>

      <div className="settings-card">
        <SettingsRow label="E-Mail Notifications">
          <Toggle checked={emailNotifs} onChange={setEmailNotifs} />
        </SettingsRow>

        <div className="settings-card-divider" />

        <SettingsRow label="Challenge Updates">
          <Toggle checked={challengeAlerts} onChange={setChallengeAlerts} />
        </SettingsRow>

        <div className="settings-card-divider" />

        <SettingsRow label="Payout Confirmations">
          <Toggle checked={payoutConfirms} onChange={setPayoutConfirms} />
        </SettingsRow>
      </div>

      {/* ── Billing & Subscription ───────────────────────────────── */}
      <div className="settings-section-title">Billing &amp; Subscription</div>

      {/* Blurred out — AI Assistant not yet available */}
      <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
        {/* Unavailable overlay */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '10px', borderRadius: '12px',
          border: '1px solid rgba(124,58,237,0.15)',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', fontWeight: 500 }}>
            AI Assistant — Coming Soon
          </span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textAlign: 'center', maxWidth: 260, lineHeight: 1.5 }}>
            Billing will be available when the AI Assistant launches.
          </span>
        </div>

        {/* Blurred content underneath */}
        <div style={{ filter: 'blur(3px)', pointerEvents: 'none', userSelect: 'none' }}>
          <div className="settings-card">
            <SettingsRow label="Current Plan">
              <span className="settings-plan-badge">AI Assistant ($25/month)</span>
            </SettingsRow>

            <div className="settings-card-divider" />

            <SettingsRow label="Billing Cycle">
              <span className="settings-row-text">Monthly</span>
            </SettingsRow>

            <div className="settings-card-divider" />

            <SettingsRow label="Payment Method">
              <div className="settings-payment-row">
                <span className="settings-row-text">****5680</span>
                <svg width="30" height="20" viewBox="0 0 38 24" aria-label="Mastercard">
                  <circle cx="15" cy="12" r="11" fill="#eb001b"/>
                  <circle cx="23" cy="12" r="11" fill="#f79e1b"/>
                  <path d="M19 5.7a11 11 0 0 1 0 12.6A11 11 0 0 1 19 5.7z" fill="#ff5f00"/>
                </svg>
              </div>
            </SettingsRow>
          </div>

          <div className="settings-billing-actions">
            <button className="settings-btn-primary">Update Payment Method</button>
            <button className="settings-btn-secondary">Cancel Subscription</button>
          </div>
        </div>
      </div>

      {/* ── Danger Zone ──────────────────────────────────────────── */}
      <div className="settings-danger-title">Danger Zone</div>

      <div className="settings-danger-actions">
        <button className="settings-btn-danger" onClick={() => setShowDeactivate(true)}>
          Deactivate Account
        </button>
        <button className="settings-btn-secondary" onClick={() => alert('Data export requested — you will receive an email shortly.')}>
          Request Data Export
        </button>
      </div>

      {showDeactivate && (
        <div className="settings-confirm-banner settings-confirm-danger">
          <span>This will deactivate your account and suspend all active challenges. Are you sure?</span>
          <div className="settings-confirm-actions">
            <button className="settings-btn-danger-sm" onClick={() => { alert('Account deactivation requested'); setShowDeactivate(false) }}>
              Yes, Deactivate
            </button>
            <button className="settings-btn-ghost-sm" onClick={() => setShowDeactivate(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
