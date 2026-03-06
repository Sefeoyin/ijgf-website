/**
 * BybitModePicker.jsx
 * Uses Bybit DEMO TRADING (bybit.com → Demo mode), NOT testnet.bybit.com
 * Demo API domain: api-demo.bybit.com (handled by /api/bybit-proxy.js)
 */
import { useState } from 'react'

const BYBIT_PROXY = '/api/bybit-proxy'

function tierToUsdt(tierKey) {
  return parseInt(tierKey.replace('k', ''), 10) * 1000
}

async function proxyCall(apiKey, apiSecret, method, endpoint, params = {}) {
  const res = await fetch(BYBIT_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret, method, endpoint, params }),
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`Proxy error ${res.status} — is /api/bybit-proxy.js deployed?`)
  const json = await res.json()
  if (json.retCode !== 0) {
    if ([10003, 10004, 33004].includes(json.retCode))
      throw new Error('Invalid API credentials. Make sure you created the key inside Demo Trading mode on bybit.com — not from your live account.')
    throw new Error(`Bybit ${json.retCode}: ${json.retMsg}`)
  }
  return json.result
}

async function validateAndSetupBybitDemo(apiKey, apiSecret, tierKey) {
  // 1. Read current balance — try UNIFIED first, fall back to CONTRACT
  let accountType = 'UNIFIED'
  let walletResult
  try {
    walletResult = await proxyCall(apiKey, apiSecret, 'GET', '/v5/account/wallet-balance', { accountType: 'UNIFIED' })
  } catch (err) {
    if (!err.message.startsWith('Invalid')) {
      accountType = 'CONTRACT'
      walletResult = await proxyCall(apiKey, apiSecret, 'GET', '/v5/account/wallet-balance', { accountType: 'CONTRACT' })
    } else throw err
  }

  const challengeUsdt = tierToUsdt(tierKey)

  // 2. Set balance to exact challenge amount via demo-apply-money
  // Correct body: { adjustType: integer, utaDemoApplyMoney: [{ coin, amountStr }] }
  // Step A: zero out ALL coins (USDT, USDC, BTC, ETH etc)
  const allCoins = walletResult?.list?.[0]?.coin ?? []
  for (const coinEntry of allCoins) {
    const bal = Math.floor(parseFloat(coinEntry.walletBalance ?? 0))
    if (bal <= 0) continue
    let rem = bal
    while (rem > 0) {
      const chunk = Math.min(rem, 100000)
      await proxyCall(apiKey, apiSecret, 'POST', '/v5/account/demo-apply-money', {
        adjustType: 1,
        utaDemoApplyMoney: [{ coin: coinEntry.coin, amountStr: String(chunk) }],
      }).catch(() => {})
      rem -= chunk
    }
  }
  // Step B: add exact challengeUsdt in USDT only
  let rem = challengeUsdt
  while (rem > 0) {
    const chunk = Math.min(rem, 100000)
    await proxyCall(apiKey, apiSecret, 'POST', '/v5/account/demo-apply-money', {
      adjustType: 0,
      utaDemoApplyMoney: [{ coin: 'USDT', amountStr: String(chunk) }],
    })
    rem -= chunk
  }

  // 3. Read final balance to confirm
  let finalEquity = challengeUsdt
  try {
    const fw = await proxyCall(apiKey, apiSecret, 'GET', '/v5/account/wallet-balance', { accountType })
    finalEquity = parseFloat(fw?.list?.[0]?.totalWalletBalance ?? challengeUsdt)
  } catch { /* use challengeUsdt as fallback */ }

  return { equity: finalEquity, challengeUsdt, accountType }
}

export default function BybitModePicker({ tierKey, startingChallenge, onCancel, onSelectIJGF, onSelectBybit }) {
  const [step,      setStep]      = useState('choose')
  const [apiKey,    setApiKey]    = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [validating,setValidating]= useState(false)
  const [error,     setError]     = useState('')
  const [equity,    setEquity]    = useState(null)

  const tierLabel     = `$${tierKey.replace('k', ',000')}`
  const challengeUsdt = tierToUsdt(tierKey)
  const busy          = startingChallenge || validating

  const handleValidate = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) { setError('Both API Key and API Secret are required.'); return }
    setValidating(true); setError('')
    try {
      const result = await validateAndSetupBybitDemo(apiKey.trim(), apiSecret.trim(), tierKey)
      setEquity(result.equity)
      setStep('confirmed')
    } catch (err) {
      setError(err.message)
    } finally { setValidating(false) }
  }

  const overlay = { position:'fixed',inset:0,zIndex:10000,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }
  const card    = { background:'#0d0f14',border:'1px solid rgba(124,58,237,0.35)',borderRadius:18,padding:'28px 24px',maxWidth:460,width:'100%',boxShadow:'0 24px 60px rgba(0,0,0,0.7)',maxHeight:'90vh',overflowY:'auto' }
  const btnBack = { width:'100%',padding:'10px',background:'transparent',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,color:'rgba(255,255,255,0.45)',cursor:'pointer',fontSize:'0.88rem',marginTop:8 }
  const input   = { width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:8,padding:'10px 14px',color:'#eaecef',fontSize:'0.88rem',outline:'none',boxSizing:'border-box',marginBottom:12,fontFamily:'monospace' }

  if (step === 'choose') return (
    <div style={overlay} onClick={e => { if (e.target===e.currentTarget && !busy) onCancel() }}>
      <div style={card}>
        <h3 style={{margin:'0 0 4px',fontSize:'1.15rem',fontWeight:700,color:'#eaecef'}}>How would you like to trade?</h3>
        <p style={{margin:'0 0 22px',fontSize:'0.83rem',color:'rgba(255,255,255,0.45)'}}>Starting <strong style={{color:'#a855f7'}}>{tierLabel} Challenge</strong></p>

        <button disabled={busy} onClick={onSelectIJGF}
          style={{width:'100%',display:'flex',alignItems:'center',gap:14,background:'rgba(124,58,237,0.08)',border:'1px solid rgba(124,58,237,0.3)',borderRadius:12,padding:'15px 16px',cursor:busy?'not-allowed':'pointer',marginBottom:10,color:'#eaecef',opacity:busy?0.6:1,transition:'all 0.15s',textAlign:'left'}}
          onMouseEnter={e=>{if(!busy)e.currentTarget.style.borderColor='rgba(124,58,237,0.7)'}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(124,58,237,0.3)'}}>
          <span style={{fontSize:'1.6rem'}}>🚀</span>
          <div><div style={{fontWeight:700,fontSize:'0.97rem',marginBottom:2}}>IJGF Market</div>
          <div style={{fontSize:'0.78rem',color:'rgba(255,255,255,0.45)'}}>Trade Binance-listed tokens inside this platform</div></div>
        </button>

        <button disabled={busy} onClick={()=>{setError('');setStep('keys')}}
          style={{width:'100%',display:'flex',alignItems:'center',gap:14,background:'rgba(245,158,11,0.07)',border:'1px solid rgba(245,158,11,0.25)',borderRadius:12,padding:'15px 16px',cursor:busy?'not-allowed':'pointer',marginBottom:20,color:'#eaecef',opacity:busy?0.6:1,transition:'all 0.15s',textAlign:'left'}}
          onMouseEnter={e=>{if(!busy)e.currentTarget.style.borderColor='rgba(245,158,11,0.55)'}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(245,158,11,0.25)'}}>
          <span style={{fontSize:'1.6rem'}}>🔗</span>
          <div><div style={{fontWeight:700,fontSize:'0.97rem',marginBottom:2}}>Bybit Demo Trading</div>
          <div style={{fontSize:'0.78rem',color:'rgba(255,255,255,0.45)'}}>Trade on Bybit's demo futures — IJGF tracks P&L and enforces challenge rules</div></div>
        </button>
        <button disabled={busy} onClick={onCancel} style={btnBack}>← Cancel</button>
      </div>
    </div>
  )

  if (step === 'keys') return (
    <div style={overlay}>
      <div style={card}>
        <div style={{textAlign:'center',marginBottom:18}}>
          <div style={{width:48,height:48,borderRadius:12,margin:'0 auto 12px',background:'rgba(245,158,11,0.15)',border:'1px solid rgba(245,158,11,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.5rem'}}>🔗</div>
          <h3 style={{margin:'0 0 4px',fontSize:'1.1rem',fontWeight:700,color:'#eaecef'}}>Connect Bybit Demo Trading</h3>
          <p style={{margin:0,fontSize:'0.82rem',color:'rgba(255,255,255,0.45)'}}>IJGF will set your <strong style={{color:'#a855f7'}}>{tierLabel}</strong> challenge balance on Bybit</p>
        </div>

        {/* Critical: Demo vs Testnet warning */}
        <div style={{background:'rgba(246,70,93,0.08)',border:'1px solid rgba(246,70,93,0.25)',borderRadius:10,padding:'10px 13px',marginBottom:14,fontSize:'0.79rem',color:'rgba(255,255,255,0.6)',lineHeight:1.65}}>
          ⚠️ <strong style={{color:'#f6465d'}}>Use Demo Trading on bybit.com</strong> — NOT testnet.bybit.com. The key must come from Demo mode or it won't work.
        </div>

        {/* Step-by-step instructions */}
        <div style={{background:'rgba(245,158,11,0.07)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:10,padding:'11px 14px',marginBottom:16,fontSize:'0.78rem',color:'rgba(255,255,255,0.5)',lineHeight:1.8}}>
          <strong style={{color:'rgba(245,158,11,0.9)'}}>Create your Demo API key:</strong>
          <ol style={{margin:'5px 0 0',paddingLeft:17}}>
            <li>Go to <strong style={{color:'rgba(255,255,255,0.8)'}}>bybit.com</strong> → click <strong style={{color:'rgba(255,255,255,0.8)'}}>Demo Trading</strong> at the top</li>
            <li>Inside Demo mode → <strong style={{color:'rgba(255,255,255,0.8)'}}>Account → API Management → Create New Key</strong></li>
            <li>Choose <strong style={{color:'rgba(255,255,255,0.8)'}}>System-generated API Keys</strong></li>
            <li>Enable: <strong style={{color:'rgba(255,255,255,0.8)'}}>Read-Write + Unified Trading + Assets</strong></li>
            <li>No IP restriction. Copy both keys below.</li>
          </ol>
        </div>

        {error && <div style={{background:'rgba(246,70,93,0.1)',border:'1px solid rgba(246,70,93,0.3)',color:'#f6465d',borderRadius:8,padding:'10px 12px',fontSize:'0.83rem',marginBottom:14,lineHeight:1.5}}>{error}</div>}

        <label style={{display:'block',fontSize:'0.79rem',color:'rgba(255,255,255,0.5)',marginBottom:4}}>Demo Trading API Key</label>
        <input type="text" placeholder="Paste API key here" value={apiKey} onChange={e=>setApiKey(e.target.value)} style={input} disabled={validating} autoComplete="off" spellCheck={false}/>

        <label style={{display:'block',fontSize:'0.79rem',color:'rgba(255,255,255,0.5)',marginBottom:4}}>Demo Trading API Secret</label>
        <input type="password" placeholder="Paste API secret here" value={apiSecret} onChange={e=>setApiSecret(e.target.value)} style={{...input,marginBottom:20}} disabled={validating} onKeyDown={e=>{if(e.key==='Enter')handleValidate()}} autoComplete="off"/>

        <button onClick={handleValidate} disabled={validating||!apiKey.trim()||!apiSecret.trim()}
          style={{width:'100%',padding:'12px',background:validating?'rgba(255,255,255,0.08)':'linear-gradient(135deg,#f59e0b,#fbbf24)',color:validating?'rgba(255,255,255,0.4)':'#000',border:'none',borderRadius:10,fontWeight:700,fontSize:'0.93rem',cursor:validating?'not-allowed':'pointer',marginBottom:8}}>
          {validating ? `Connecting & setting ${tierLabel} balance…` : 'Validate & Set Challenge Balance'}
        </button>
        <button disabled={validating} onClick={()=>setStep('choose')} style={btnBack}>← Back</button>
      </div>
    </div>
  )

  if (step === 'confirmed') return (
    <div style={overlay}>
      <div style={card}>
        <div style={{textAlign:'center',marginBottom:22}}>
          <div style={{width:56,height:56,borderRadius:'50%',margin:'0 auto 14px',background:'rgba(34,197,94,0.15)',border:'2px solid rgba(34,197,94,0.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.8rem'}}>✅</div>
          <h3 style={{margin:'0 0 6px',fontSize:'1.15rem',fontWeight:700,color:'#22c55e'}}>Bybit Demo Connected!</h3>
          <p style={{margin:0,fontSize:'0.84rem',color:'rgba(255,255,255,0.5)'}}>Challenge balance set on your Bybit Demo account</p>
        </div>

        <div style={{background:'rgba(34,197,94,0.06)',border:'1px solid rgba(34,197,94,0.2)',borderRadius:12,padding:'15px 17px',marginBottom:16}}>
          {[
            {label:'Bybit Demo Balance', value:`$${equity?.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})??'—'}`, color:'#22c55e'},
            {label:'Challenge Size',     value:tierLabel,               color:'#eaecef'},
            {label:'Environment',        value:'Bybit Demo Trading',    color:'#f59e0b'},
          ].map(r=>(
            <div key={r.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <span style={{fontSize:'0.82rem',color:'rgba(255,255,255,0.5)'}}>{r.label}</span>
              <span style={{fontSize:'0.93rem',fontWeight:600,color:r.color}}>{r.value}</span>
            </div>
          ))}
        </div>

        {equity != null && Math.abs(equity - challengeUsdt) > 500 && (
          <div style={{background:'rgba(245,158,11,0.07)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:9,padding:'10px 13px',marginBottom:14,fontSize:'0.77rem',color:'rgba(255,255,255,0.5)',lineHeight:1.6}}>
            💡 Bybit shows ${equity?.toLocaleString()} — IJGF measures P&L from your {tierLabel} challenge starting balance. Balance will re-sync when all positions are closed.
          </div>
        )}

        <button onClick={()=>onSelectBybit(apiKey.trim(),apiSecret.trim(),equity??challengeUsdt)} disabled={startingChallenge}
          style={{width:'100%',padding:'13px',background:startingChallenge?'rgba(255,255,255,0.08)':'linear-gradient(135deg,#f59e0b,#fbbf24)',color:startingChallenge?'rgba(255,255,255,0.4)':'#000',border:'none',borderRadius:10,fontWeight:700,fontSize:'0.97rem',cursor:startingChallenge?'not-allowed':'pointer',marginBottom:8}}>
          {startingChallenge?'Starting Challenge…':`Start ${tierLabel} Challenge on Bybit`}
        </button>
        <button disabled={startingChallenge} onClick={()=>{setStep('keys');setEquity(null)}} style={btnBack}>← Use different keys</button>
      </div>
    </div>
  )

  return null
}
