/**
 * BybitModePicker.jsx
 *
 * 3-step modal rendered inside DashboardOverview when a user picks a challenge tier.
 *
 * Step 1 — choose: IJGF Market or Connect Bybit Demo
 * Step 2 — Bybit: enter API Key + Secret, instructions shown
 * Step 3 — Bybit: validate credentials via /api/bybit-proxy, show confirmed balance
 *
 * Props:
 *   tierKey           string   — e.g. '10k', '25k'
 *   userId            string
 *   startingChallenge bool
 *   setStartingChallenge fn
 *   onCancel          fn       — close the picker with no action
 *   onSelectIJGF      fn       — async, starts IJGF challenge
 *   onSelectBybit     fn(apiKey, apiSecret, equity) — async, starts Bybit challenge
 */

import { useState } from 'react'

const BYBIT_PROXY = '/api/bybit-proxy'

async function validateBybitKeys(apiKey, apiSecret) {
  const res = await fetch(BYBIT_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      apiSecret,
      method: 'GET',
      endpoint: '/v5/account/wallet-balance',
      params: { accountType: 'UNIFIED' },
    }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Proxy error ${res.status}`)
  const json = await res.json()
  if (json.retCode !== 0) throw new Error(`Bybit: ${json.retMsg} (code ${json.retCode})`)
  const coins  = json.result?.list?.[0]?.coin ?? []
  const usdt   = coins.find(c => c.coin === 'USDT')
  const equity = parseFloat(usdt?.equity ?? usdt?.walletBalance ?? 0)
  return { equity }
}

export default function BybitModePicker({
  tierKey, startingChallenge,
  onCancel, onSelectIJGF, onSelectBybit,
}) {
  const [step,       setStep]       = useState('choose')  // 'choose' | 'keys' | 'confirmed'
  const [apiKey,     setApiKey]     = useState('')
  const [apiSecret,  setApiSecret]  = useState('')
  const [validating, setValidating] = useState(false)
  const [error,      setError]      = useState('')
  const [equity,     setEquity]     = useState(null)

  const tierLabel = `$${tierKey.replace('k', ',000')}`
  const busy = startingChallenge || validating

  const handleValidate = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      setError('Both API Key and API Secret are required.')
      return
    }
    setValidating(true)
    setError('')
    try {
      const result = await validateBybitKeys(apiKey.trim(), apiSecret.trim())
      setEquity(result.equity)
      setStep('confirmed')
    } catch (err) {
      setError(
        err.message.includes('10003') || err.message.includes('Invalid')
          ? 'Invalid API credentials. Check your key and secret and try again.'
          : err.message.includes('Proxy') || err.message.includes('fetch')
          ? 'Could not reach Bybit. Check your internet connection and try again.'
          : err.message
      )
    } finally {
      setValidating(false)
    }
  }

  const overlay = {
    position:'fixed', inset:0, zIndex:10000,
    background:'rgba(0,0,0,0.82)', backdropFilter:'blur(6px)',
    display:'flex', alignItems:'center', justifyContent:'center', padding:16,
  }
  const card = {
    background:'#0d0f14', border:'1px solid rgba(124,58,237,0.35)',
    borderRadius:18, padding:'28px 24px', maxWidth:440, width:'100%',
    boxShadow:'0 24px 60px rgba(0,0,0,0.6)',
  }
  const btnBack = {
    width:'100%', padding:'10px', background:'transparent',
    border:'1px solid rgba(255,255,255,0.1)', borderRadius:10,
    color:'rgba(255,255,255,0.45)', cursor:'pointer', fontSize:'0.88rem',
    marginTop:8,
  }
  const inputStyle = {
    width:'100%', background:'rgba(255,255,255,0.05)',
    border:'1px solid rgba(255,255,255,0.12)', borderRadius:8,
    padding:'10px 14px', color:'#eaecef', fontSize:'0.9rem',
    outline:'none', boxSizing:'border-box', marginBottom:12,
  }

  // ── Step 1: Choose mode ────────────────────────────────────────────────
  if (step === 'choose') return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget && !busy) onCancel() }}>
      <div style={card}>
        <h3 style={{margin:'0 0 4px', fontSize:'1.15rem', fontWeight:700, color:'#eaecef'}}>
          How would you like to trade?
        </h3>
        <p style={{margin:'0 0 22px', fontSize:'0.83rem', color:'rgba(255,255,255,0.45)'}}>
          Starting <strong style={{color:'#a855f7'}}>{tierLabel} Challenge</strong>
        </p>

        {/* IJGF Market */}
        <button
          disabled={busy}
          onClick={onSelectIJGF}
          style={{
            width:'100%', display:'flex', alignItems:'center', gap:14,
            background:'rgba(124,58,237,0.08)', border:'1px solid rgba(124,58,237,0.3)',
            borderRadius:12, padding:'15px 16px',
            cursor: busy ? 'not-allowed' : 'pointer',
            marginBottom:10, color:'#eaecef', opacity: busy ? 0.6 : 1,
            transition:'all 0.15s', textAlign:'left',
          }}
          onMouseEnter={e => { if (!busy) e.currentTarget.style.borderColor = 'rgba(124,58,237,0.7)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)' }}
        >
          <span style={{fontSize:'1.6rem'}}>🚀</span>
          <div>
            <div style={{fontWeight:700, fontSize:'0.97rem', marginBottom:2}}>IJGF Market</div>
            <div style={{fontSize:'0.78rem', color:'rgba(255,255,255,0.45)'}}>
              Trade Binance-listed tokens directly inside this platform
            </div>
          </div>
          {startingChallenge && <span style={{marginLeft:'auto', fontSize:'0.8rem', color:'#a855f7'}}>Starting…</span>}
        </button>

        {/* Connect Bybit */}
        <button
          disabled={busy}
          onClick={() => { setError(''); setStep('keys') }}
          style={{
            width:'100%', display:'flex', alignItems:'center', gap:14,
            background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.25)',
            borderRadius:12, padding:'15px 16px',
            cursor: busy ? 'not-allowed' : 'pointer',
            marginBottom:20, color:'#eaecef', opacity: busy ? 0.6 : 1,
            transition:'all 0.15s', textAlign:'left',
          }}
          onMouseEnter={e => { if (!busy) e.currentTarget.style.borderColor = 'rgba(245,158,11,0.55)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.25)' }}
        >
          <span style={{fontSize:'1.6rem'}}>🔗</span>
          <div>
            <div style={{fontWeight:700, fontSize:'0.97rem', marginBottom:2}}>Connect Bybit Demo</div>
            <div style={{fontSize:'0.78rem', color:'rgba(255,255,255,0.45)'}}>
              Trade on Bybit Testnet — IJGF tracks your balance and P&L
            </div>
          </div>
        </button>

        <button disabled={busy} onClick={onCancel} style={btnBack}>← Cancel</button>
      </div>
    </div>
  )

  // ── Step 2: Enter Bybit API keys ──────────────────────────────────────
  if (step === 'keys') return (
    <div style={overlay}>
      <div style={card}>
        <div style={{textAlign:'center', marginBottom:20}}>
          <div style={{
            width:48, height:48, borderRadius:12, margin:'0 auto 12px',
            background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.3)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem',
          }}>🔗</div>
          <h3 style={{margin:'0 0 4px', fontSize:'1.1rem', fontWeight:700, color:'#eaecef'}}>
            Connect Bybit Testnet
          </h3>
          <p style={{margin:0, fontSize:'0.82rem', color:'rgba(255,255,255,0.45)'}}>
            Your <strong style={{color:'#a855f7'}}>{tierLabel} challenge</strong> will be tracked on your Bybit demo account
          </p>
        </div>

        {/* Instructions */}
        <div style={{
          background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.2)',
          borderRadius:10, padding:'12px 14px', marginBottom:18,
          fontSize:'0.79rem', color:'rgba(255,255,255,0.5)', lineHeight:1.75,
        }}>
          <strong style={{color:'rgba(245,158,11,0.9)'}}>How to get your API key:</strong>
          <ol style={{margin:'6px 0 0', paddingLeft:18}}>
            <li>Go to <strong style={{color:'rgba(255,255,255,0.7)'}}>testnet.bybit.com</strong> and log in</li>
            <li>Account → API Management → Create New Key</li>
            <li>Enable <strong style={{color:'rgba(255,255,255,0.7)'}}>Read + Trade</strong> only — do NOT enable withdrawals</li>
            <li>Copy both keys and paste below</li>
          </ol>
        </div>

        {error && (
          <div style={{
            background:'rgba(246,70,93,0.1)', border:'1px solid rgba(246,70,93,0.3)',
            color:'#f6465d', borderRadius:8, padding:'10px 12px',
            fontSize:'0.83rem', marginBottom:14,
          }}>{error}</div>
        )}

        <label style={{display:'block', fontSize:'0.79rem', color:'rgba(255,255,255,0.5)', marginBottom:5}}>
          API Key
        </label>
        <input
          type="password"
          placeholder="Paste your Bybit Testnet API key"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          style={inputStyle}
          disabled={validating}
        />

        <label style={{display:'block', fontSize:'0.79rem', color:'rgba(255,255,255,0.5)', marginBottom:5}}>
          API Secret
        </label>
        <input
          type="password"
          placeholder="Paste your Bybit Testnet API secret"
          value={apiSecret}
          onChange={e => setApiSecret(e.target.value)}
          style={{...inputStyle, marginBottom:20}}
          disabled={validating}
          onKeyDown={e => { if (e.key === 'Enter') handleValidate() }}
        />

        <button
          onClick={handleValidate}
          disabled={validating || !apiKey.trim() || !apiSecret.trim()}
          style={{
            width:'100%', padding:'12px',
            background: validating ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#f59e0b,#fbbf24)',
            color: validating ? 'rgba(255,255,255,0.4)' : '#000',
            border:'none', borderRadius:10, fontWeight:700,
            fontSize:'0.95rem', cursor: validating ? 'not-allowed' : 'pointer',
            marginBottom:8,
          }}
        >
          {validating ? 'Validating credentials…' : 'Validate & Connect'}
        </button>
        <button disabled={validating} onClick={() => setStep('choose')} style={btnBack}>← Back</button>
      </div>
    </div>
  )

  // ── Step 3: Confirmed — show balance and start ────────────────────────
  if (step === 'confirmed') return (
    <div style={overlay}>
      <div style={card}>
        <div style={{textAlign:'center', marginBottom:24}}>
          <div style={{
            width:56, height:56, borderRadius:'50%', margin:'0 auto 14px',
            background:'rgba(34,197,94,0.15)', border:'2px solid rgba(34,197,94,0.4)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.8rem',
          }}>✅</div>
          <h3 style={{margin:'0 0 6px', fontSize:'1.15rem', fontWeight:700, color:'#22c55e'}}>
            Bybit Connected!
          </h3>
          <p style={{margin:0, fontSize:'0.84rem', color:'rgba(255,255,255,0.5)'}}>
            Your Bybit Testnet account is verified and ready
          </p>
        </div>

        {/* Account summary */}
        <div style={{
          background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)',
          borderRadius:12, padding:'16px 18px', marginBottom:22,
        }}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
            <span style={{fontSize:'0.82rem', color:'rgba(255,255,255,0.5)'}}>Bybit USDT Balance</span>
            <span style={{fontSize:'1.1rem', fontWeight:700, color:'#22c55e'}}>
              ${equity?.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) ?? '—'}
            </span>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
            <span style={{fontSize:'0.82rem', color:'rgba(255,255,255,0.5)'}}>Challenge Size</span>
            <span style={{fontSize:'0.95rem', fontWeight:600, color:'#eaecef'}}>{tierLabel}</span>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <span style={{fontSize:'0.82rem', color:'rgba(255,255,255,0.5)'}}>Mode</span>
            <span style={{
              fontSize:'0.78rem', fontWeight:700, background:'rgba(245,158,11,0.15)',
              color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)',
              borderRadius:20, padding:'2px 10px',
            }}>Bybit Testnet</span>
          </div>
        </div>

        {/* Bybit testnet funding note */}
        <div style={{
          background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:10, padding:'11px 14px', marginBottom:20,
          fontSize:'0.78rem', color:'rgba(255,255,255,0.45)', lineHeight:1.7,
        }}>
          💡 <strong style={{color:'rgba(255,255,255,0.65)'}}>Need testnet funds?</strong> Go to testnet.bybit.com → Assets → Testnet Faucet to top up your USDT demo balance for free.
        </div>

        <button
          onClick={() => onSelectBybit(apiKey.trim(), apiSecret.trim(), equity)}
          disabled={startingChallenge}
          style={{
            width:'100%', padding:'13px',
            background: startingChallenge ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#f59e0b,#fbbf24)',
            color: startingChallenge ? 'rgba(255,255,255,0.4)' : '#000',
            border:'none', borderRadius:10, fontWeight:700,
            fontSize:'0.97rem', cursor: startingChallenge ? 'not-allowed' : 'pointer',
            marginBottom:8,
          }}
        >
          {startingChallenge ? 'Starting Challenge…' : `Start ${tierLabel} Challenge on Bybit`}
        </button>
        <button
          disabled={startingChallenge}
          onClick={() => { setStep('keys'); setEquity(null) }}
          style={btnBack}
        >← Use different keys</button>
      </div>
    </div>
  )

  return null
}
