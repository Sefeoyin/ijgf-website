/**
 * BybitModePicker.jsx
 * Uses Bybit DEMO TRADING (bybit.com → Demo mode), NOT testnet.bybit.com
 * Demo API domain: api-demo.bybit.com (handled by /api/bybit-proxy.js)
 *
 * CRITICAL — API KEY PERMISSION REQUIRED:
 * demo-apply-money requires: Wallet → AccountTransfer (or SubMemberTransfer)
 * WITHOUT this permission, Bybit returns retCode 10005 (Permission denied)
 * and the balance will never be set. Users MUST enable this when creating key.
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
    if (json.retCode === 10005)
      throw new Error('PERMISSION_DENIED')
    throw new Error(`Bybit error ${json.retCode}: ${json.retMsg}`)
  }
  return json.result
}

async function validateAndSetupBybitDemo(apiKey, apiSecret, tierKey) {
  // ── Step 1: Verify credentials & read current balance ──────────────────
  let walletResult
  let accountType = 'UNIFIED'
  try {
    walletResult = await proxyCall(apiKey, apiSecret, 'GET', '/v5/account/wallet-balance', { accountType: 'UNIFIED' })
  } catch (err) {
    if (err.message === 'PERMISSION_DENIED' || !err.message.startsWith('Invalid')) {
      accountType = 'CONTRACT'
      walletResult = await proxyCall(apiKey, apiSecret, 'GET', '/v5/account/wallet-balance', { accountType: 'CONTRACT' })
    } else throw err
  }

  const coins = walletResult?.list?.[0]?.coin ?? []
  const usdtCoin = coins.find(c => c.coin === 'USDT')
  const currentEquity = parseFloat(usdtCoin?.equity ?? usdtCoin?.walletBalance ?? 0)
  const challengeUsdt = tierToUsdt(tierKey)

  // ── Step 2: Set balance via demo-apply-money ────────────────────────────
  // Official Bybit V5 spec:
  //   POST /v5/account/demo-apply-money
  //   { adjustType: 0, utaDemoApplyMoney: [{ coin: "USDT", amountStr: "10000" }] }
  //   adjustType: 0 = ADD funds, 1 = REDUCE funds  (integers, not strings)
  //   max per call: 100,000 USDT
  //   REQUIRED PERMISSION: Wallet → AccountTransfer

  if (currentEquity > challengeUsdt + 200) {
    // Need to reduce. Call with adjustType: 1
    const excess = Math.floor(currentEquity - challengeUsdt)
    try {
      await proxyCall(apiKey, apiSecret, 'POST', '/v5/account/demo-apply-money', {
        adjustType: 1,
        utaDemoApplyMoney: [{ coin: 'USDT', amountStr: String(Math.min(excess, 100000)) }],
      })
    } catch (err) {
      if (err.message === 'PERMISSION_DENIED') throw new Error('PERMISSION_DENIED')
      // Open positions may block reduction — non-fatal, continue
      console.warn('[BybitModePicker] Balance reduction blocked (open positions?):', err.message)
    }
  } else if (currentEquity < challengeUsdt - 200) {
    // Need to add funds. Call with adjustType: 0 — NOT silenced
    const needed = Math.ceil(challengeUsdt - currentEquity)
    await proxyCall(apiKey, apiSecret, 'POST', '/v5/account/demo-apply-money', {
      adjustType: 0,
      utaDemoApplyMoney: [{ coin: 'USDT', amountStr: String(Math.min(needed, 100000)) }],
    })
  }

  // ── Step 3: Read final balance after adjustment ─────────────────────────
  let finalEquity = challengeUsdt
  try {
    const fw = await proxyCall(apiKey, apiSecret, 'GET', '/v5/account/wallet-balance', { accountType })
    const fc = fw?.list?.[0]?.coin ?? []
    const fu = fc.find(c => c.coin === 'USDT')
    finalEquity = parseFloat(fu?.equity ?? fu?.walletBalance ?? challengeUsdt)
  } catch { /* fallback to challengeUsdt */ }

  return { equity: finalEquity, challengeUsdt, accountType }
}

export default function BybitModePicker({ tierKey, startingChallenge, onCancel, onSelectIJGF, onSelectBybit }) {
  const [step,      setStep]      = useState('choose')
  const [apiKey,    setApiKey]    = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [validating,setValidating]= useState(false)
  const [error,     setError]     = useState('')
  const [equity,    setEquity]    = useState(null)
  const [permError, setPermError] = useState(false)

  const tierLabel     = `$${tierKey.replace('k', ',000')}`
  const challengeUsdt = tierToUsdt(tierKey)
  const busy          = startingChallenge || validating

  const handleValidate = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) { setError('Both API Key and API Secret are required.'); return }
    setValidating(true); setError(''); setPermError(false)
    try {
      const result = await validateAndSetupBybitDemo(apiKey.trim(), apiSecret.trim(), tierKey)
      setEquity(result.equity)
      setStep('confirmed')
    } catch (err) {
      if (err.message === 'PERMISSION_DENIED') {
        setPermError(true)
        setError('Your API key is missing the Wallet → AccountTransfer permission. See the fix below.')
      } else {
        setError(err.message)
      }
    } finally { setValidating(false) }
  }

  const overlay = { position:'fixed',inset:0,zIndex:10000,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }
  const card    = { background:'#0d0f14',border:'1px solid rgba(124,58,237,0.35)',borderRadius:18,padding:'28px 24px',maxWidth:480,width:'100%',boxShadow:'0 24px 60px rgba(0,0,0,0.7)',maxHeight:'90vh',overflowY:'auto' }
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

        <button disabled={busy} onClick={()=>{setError('');setPermError(false);setStep('keys')}}
          style={{width:'100%',display:'flex',alignItems:'center',gap:14,background:'rgba(245,158,11,0.07)',border:'1px solid rgba(245,158,11,0.25)',borderRadius:12,padding:'15px 16px',cursor:busy?'not-allowed':'pointer',marginBottom:20,color:'#eaecef',opacity:busy?0.6:1,transition:'all 0.15s',textAlign:'left'}}
          onMouseEnter={e=>{if(!busy)e.currentTarget.style.borderColor='rgba(245,158,11,0.55)'}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(245,158,11,0.25)'}}>
          <span style={{fontSize:'1.6rem'}}>🔗</span>
          <div><div style={{fontWeight:700,fontSize:'0.97rem',marginBottom:2}}>Bybit Demo Trading</div>
          <div style={{fontSize:'0.78rem',color:'rgba(255,255,255,0.45)'}}>Trade on Bybit's demo futures — IJGF sets your balance and tracks P&L</div></div>
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
          <p style={{margin:0,fontSize:'0.82rem',color:'rgba(255,255,255,0.45)'}}>IJGF will set your Bybit Demo balance to <strong style={{color:'#a855f7'}}>{tierLabel}</strong></p>
        </div>

        {/* Critical: Demo vs Testnet warning */}
        <div style={{background:'rgba(246,70,93,0.08)',border:'1px solid rgba(246,70,93,0.25)',borderRadius:10,padding:'10px 13px',marginBottom:12,fontSize:'0.79rem',color:'rgba(255,255,255,0.6)',lineHeight:1.65}}>
          ⚠️ <strong style={{color:'#f6465d'}}>Use Demo Trading on bybit.com</strong> — NOT testnet.bybit.com
        </div>

        {/* API key instructions — AccountTransfer is the critical one */}
        <div style={{background:'rgba(245,158,11,0.07)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:10,padding:'11px 14px',marginBottom:12,fontSize:'0.78rem',color:'rgba(255,255,255,0.5)',lineHeight:1.9}}>
          <strong style={{color:'rgba(245,158,11,0.9)',fontSize:'0.8rem'}}>Create your Demo API key (exact steps):</strong>
          <ol style={{margin:'6px 0 0',paddingLeft:18}}>
            <li>Go to <strong style={{color:'rgba(255,255,255,0.85)'}}>bybit.com</strong> → click <strong style={{color:'rgba(255,255,255,0.85)'}}>Demo Trading</strong> at the top</li>
            <li>Inside Demo mode → avatar → <strong style={{color:'rgba(255,255,255,0.85)'}}>API Management → Create New Key</strong></li>
            <li>Choose <strong style={{color:'rgba(255,255,255,0.85)'}}>System-generated API Keys</strong></li>
            <li>
              Enable these permissions:
              <div style={{marginTop:5,display:'flex',flexDirection:'column',gap:3}}>
                {[
                  {label:'Contract Trade → Orders & Positions', required:true},
                  {label:'Unified Trading', required:true},
                  {label:'Wallet → Account Transfer', required:true, critical:true},
                ].map(p => (
                  <div key={p.label} style={{display:'flex',alignItems:'center',gap:6,padding:'3px 7px',borderRadius:5,background:p.critical?'rgba(245,158,11,0.12)':'rgba(255,255,255,0.04)',border:p.critical?'1px solid rgba(245,158,11,0.3)':'1px solid transparent'}}>
                    <span style={{color:p.critical?'#f59e0b':'#22c55e',fontSize:'0.85rem'}}>{p.critical?'★':'✓'}</span>
                    <span style={{color:p.critical?'rgba(245,158,11,0.95)':'rgba(255,255,255,0.6)',fontWeight:p.critical?700:400}}>{p.label}</span>
                    {p.critical && <span style={{marginLeft:'auto',fontSize:'0.7rem',color:'#f59e0b',fontWeight:700}}>REQUIRED FOR BALANCE SET</span>}
                  </div>
                ))}
              </div>
            </li>
            <li>No IP restriction. Copy both keys below.</li>
          </ol>
        </div>

        {/* Permission error — show targeted fix */}
        {permError && (
          <div style={{background:'rgba(246,70,93,0.1)',border:'1px solid rgba(246,70,93,0.4)',borderRadius:9,padding:'12px 14px',marginBottom:12,fontSize:'0.8rem',lineHeight:1.65}}>
            <div style={{color:'#f6465d',fontWeight:700,marginBottom:6}}>🔑 Missing Permission: Wallet → Account Transfer</div>
            <div style={{color:'rgba(255,255,255,0.6)'}}>Your API key doesn't have the permission needed to set the demo balance. Fix it:</div>
            <ol style={{margin:'6px 0 0',paddingLeft:16,color:'rgba(255,255,255,0.7)'}}>
              <li>On Bybit Demo Trading → <strong>API Management</strong></li>
              <li>Delete this key and create a new one</li>
              <li>Enable <strong style={{color:'#f59e0b'}}>Wallet → Account Transfer</strong> ← this is the missing one</li>
              <li>Paste the new keys here</li>
            </ol>
          </div>
        )}

        {error && !permError && (
          <div style={{background:'rgba(246,70,93,0.1)',border:'1px solid rgba(246,70,93,0.3)',color:'#f6465d',borderRadius:8,padding:'10px 12px',fontSize:'0.83rem',marginBottom:12,lineHeight:1.5}}>
            {error}
          </div>
        )}

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
            {label:'Challenge Size',    value:tierLabel,               color:'#eaecef'},
            {label:'Environment',       value:'Bybit Demo Trading',    color:'#f59e0b'},
          ].map(r=>(
            <div key={r.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <span style={{fontSize:'0.82rem',color:'rgba(255,255,255,0.5)'}}>{r.label}</span>
              <span style={{fontSize:'0.93rem',fontWeight:600,color:r.color}}>{r.value}</span>
            </div>
          ))}
        </div>

        {equity != null && Math.abs(equity - challengeUsdt) > 500 && (
          <div style={{background:'rgba(245,158,11,0.07)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:9,padding:'10px 13px',marginBottom:14,fontSize:'0.77rem',color:'rgba(255,255,255,0.5)',lineHeight:1.6}}>
            💡 Bybit shows <strong>${equity?.toLocaleString('en-US',{maximumFractionDigits:0})}</strong> — this may be due to open positions blocking the exact balance reset. IJGF tracks P&L from your <strong>{tierLabel}</strong> starting reference. Close all positions on Bybit then reconnect for an exact reset.
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
