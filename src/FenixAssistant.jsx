import { useState, useRef, useEffect, useContext, useCallback } from 'react'
import { supabase } from './supabase'
import { getAccountState } from './tradingService'
import { ThemeContext } from './ThemeContext'

// ─── Weekly usage tracking (shared key with AIAssistantPage) ─────────────────
const STORAGE_KEY = 'ijgf_ai_usage'
const MAX_FREE = 5

function getWeekStart() {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(new Date().setDate(diff))
  return mon.toISOString().slice(0, 10)
}
function getUsage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { count: 0, weekStart: getWeekStart() }
    const data = JSON.parse(raw)
    if (data.weekStart !== getWeekStart()) return { count: 0, weekStart: getWeekStart() }
    return data
  } catch { return { count: 0, weekStart: getWeekStart() } }
}
function saveUsage(count) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ count, weekStart: getWeekStart() }))
}

// ─── Crypto topic filter ─────────────────────────────────────────────────────
const CRYPTO_KEYWORDS = [
  'btc','bitcoin','eth','ethereum','crypto','trade','trading','market','futures',
  'perpetual','perp','usdt','usdc','short','long','position','leverage','pnl',
  'profit','loss','drawdown','risk','stop loss','take profit','entry','exit',
  'candle','chart','indicator','rsi','macd','ema','sma','volume','liquidation',
  'funding rate','order','limit','market order','altcoin','sol','bnb','xrp',
  'portfolio','performance','win rate','strategy','setup','breakout','support',
  'resistance','trend','analysis','exchange','binance','bybit','okx','margin',
  'balance','account','challenge','funded','payout','withdrawal','my trade',
  'last trade','recent trade','my performance','review','improve','what happened',
  'why did i','how can i','help me','price','bearish','bullish','sentiment',
  'hi','hello','hey','good','morning','evening','thanks','thank',
  'what can you','who are you'
]
function isCryptoRelated(text) {
  const lower = text.toLowerCase()
  if (lower.length < 20) return true
  return CRYPTO_KEYWORDS.some(kw => lower.includes(kw))
}

// ─── Trading context builder ─────────────────────────────────────────────────
function buildTradingContext(account, trades, positions) {
  const parts = []
  if (account) {
    parts.push('ACCOUNT: Balance $' + (account.current_balance || 0).toLocaleString() +
      ' / Initial $' + (account.initial_balance || 0).toLocaleString() +
      ' | PNL $' + ((account.current_balance || 0) - (account.initial_balance || 0)).toFixed(2) +
      ' | Win Rate ' + (account.total_trades > 0 ? ((account.winning_trades / account.total_trades) * 100).toFixed(1) : '0') + '%' +
      ' | Trades ' + (account.total_trades || 0) + ' (' + (account.winning_trades || 0) + 'W/' + (account.losing_trades || 0) + 'L)' +
      ' | Target $' + (account.profit_target || 0) +
      ' | Max DD $' + (account.max_total_drawdown || account.max_drawdown_limit || 0) +
      ' | Daily DD $' + (account.daily_drawdown_limit || 0) +
      ' | Daily Loss $' + (account.daily_loss || 0) +
      ' | Status ' + (account.status || 'active'))
  }
  if (positions && positions.length > 0) {
    parts.push('OPEN POSITIONS:')
    positions.forEach(p => {
      parts.push('- ' + (p.side || '').toUpperCase() + ' ' + p.symbol +
        ' @ $' + p.entry_price + ' | ' + p.leverage + 'x | UPNL $' + (p.unrealized_pnl || p.pnl || 0).toFixed(2) +
        (p.take_profit ? ' TP $' + p.take_profit : '') +
        (p.stop_loss ? ' SL $' + p.stop_loss : ' NO SL'))
    })
  }
  if (trades && trades.length > 0) {
    const recent = trades.slice(0, 10)
    parts.push('RECENT TRADES (' + recent.length + '):')
    recent.forEach(t => {
      const pnl = t.realized_pnl || t.pnl || 0
      parts.push('- ' + (t.side || '').toUpperCase() + ' ' + t.symbol +
        ' Entry $' + t.entry_price + ' Exit $' + (t.exit_price || '?') +
        ' PNL ' + (pnl >= 0 ? '+' : '') + '$' + pnl.toFixed(2) +
        ' ' + (t.leverage || 1) + 'x ' + new Date(t.executed_at).toLocaleDateString())
    })
    const wins = trades.filter(t => (t.realized_pnl || t.pnl || 0) > 0)
    const losses = trades.filter(t => (t.realized_pnl || t.pnl || 0) < 0)
    const avgW = wins.length > 0 ? wins.reduce((s, t) => s + (t.realized_pnl || t.pnl || 0), 0) / wins.length : 0
    const avgL = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.realized_pnl || t.pnl || 0), 0) / losses.length) : 0
    parts.push('STATS: Avg Win $' + avgW.toFixed(2) + ' | Avg Loss $' + avgL.toFixed(2) + ' | R:R ' + (avgL > 0 ? (avgW / avgL).toFixed(2) : 'N/A'))
  }
  return parts.join('\n') || 'No trading data available yet.'
}

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = 'You are Fenix, the IJGF AI Trading Analyst — a professional crypto trading analyst embedded in a prop trading challenge platform.\n\nPERSONALITY: Direct, data-driven, actionable. Like a senior trader mentoring a junior. Reference actual data when available. Use **bold** for key numbers.\n\nPLATFORM RULES:\n- Profit Target: 10% of initial balance\n- Daily Loss Limit: 4%\n- Max Overall Drawdown: 6% static\n- Max Leverage: 8x BTC/ETH, 5x altcoins\n- Profit Split: 80%\n\nRULES:\n- Reference the trader\'s actual numbers when data exists\n- If max drawdown remaining < 20%, lead with a risk warning\n- Keep responses under 250 words unless detailed analysis needed\n- End risk questions with a MAX SAFE POSITION SIZE figure\n- Frame as educational, not financial advice'

// ─── Call Supabase Edge Function (same as AIAssistantPage) ───────────────────
async function callAI(messages, tradingContext) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const systemMsg = SYSTEM_PROMPT + '\n\nTRADER DATA:\n' + tradingContext
  try {
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token
    if (!token) throw new Error('Not authenticated')
    const res = await fetch(supabaseUrl + '/functions/v1/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ system: systemMsg, messages: messages.map(m => ({ role: m.role, content: m.content })) }),
    })
    if (!res.ok) throw new Error('API ' + res.status)
    const data = await res.json()
    return data.content || data.message || data.text || null
  } catch (err) {
    console.warn('[FENIX] Edge function unavailable, using local engine:', err.message)
    return null
  }
}

// ─── Local fallback engine ────────────────────────────────────────────────────
function generateLocalResponse(message, account, trades, positions) {
  const lower = message.toLowerCase()

  if (lower.match(/^(hi|hello|hey|good morning|good evening|sup|what.s up|what can you|who are you)/)) {
    let resp = 'Fenix online. I can help with:\n\n'
    resp += '• **Risk Check** — drawdown exposure & position sizing\n'
    resp += '• **Trade Journal** — analyze entries, exits, patterns\n'
    resp += '• **Position Review** — live exposure check\n'
    resp += '• **Strategy** — challenge-specific setups\n'
    if (account) {
      const wr = account.total_trades ? ((account.winning_trades / account.total_trades) * 100).toFixed(0) : '0'
      resp += '\nAccount: $' + (account.current_balance || 0).toLocaleString() + ' | ' + wr + '% win rate | ' + (account.total_trades || 0) + ' trades'
    }
    return resp
  }

  if (lower.includes('risk') || lower.includes('drawdown') || lower.includes('assessment')) {
    if (!account) return 'No active challenge found. Start one from the Dashboard to unlock risk analysis.'
    const used = Math.max(0, (account.initial_balance || 0) - (account.current_balance || 0))
    const maxDD = account.max_total_drawdown || account.max_drawdown_limit || 0
    const dailyDD = account.daily_drawdown_limit || 0
    const dailyL = account.daily_loss || 0
    const ddPct = maxDD > 0 ? ((used / maxDD) * 100).toFixed(1) : '0'
    const dailyPct = dailyDD > 0 ? ((dailyL / dailyDD) * 100).toFixed(1) : '0'
    const remaining = (maxDD - used).toFixed(2)
    const safe1pct = ((account.current_balance || 0) * 0.01).toFixed(2)
    const risk = ddPct > 70 ? 'CRITICAL' : ddPct > 40 ? 'CAUTION' : 'SAFE'
    return '**Risk Assessment — ' + risk + '**\n\nMax Drawdown: $' + used.toFixed(2) + ' / $' + maxDD + ' (' + ddPct + '%)\nDaily Loss: $' + dailyL.toFixed(2) + ' / $' + dailyDD + ' (' + dailyPct + '%)\nRemaining Buffer: $' + remaining + '\n\n' + (ddPct > 70 ? 'Critical zone — reduce size immediately.' : ddPct > 40 ? 'Approaching caution zone — trade smaller.' : 'Healthy buffer. Maintain discipline.') + '\n\n**MAX SAFE POSITION SIZE**: ~$' + safe1pct + ' (1% risk)'
  }

  if (lower.includes('analyze') && (lower.includes('last trade') || lower.includes('recent trade'))) {
    if (!trades || !trades.length) return 'No closed trades yet. Start trading and I\'ll analyze your entries, exits, and risk management.'
    const last = trades[0]
    const pnl = last.realized_pnl || last.pnl || 0
    const sym = last.symbol || 'BTCUSDT'
    const side = (last.side || 'LONG').toUpperCase()
    const entry = last.entry_price ? '$' + Number(last.entry_price).toLocaleString() : 'N/A'
    const exit = last.exit_price ? '$' + Number(last.exit_price).toLocaleString() : 'N/A'
    const lev = last.leverage || 1
    if (pnl > 0) return '**' + sym + ' ' + side + ' — Profitable**\n\nEntry: ' + entry + ' Exit: ' + exit + ' | ' + lev + 'x\nPNL: +$' + pnl.toFixed(2) + '\n\n• Was this a planned entry or a chase?\n• Aim for 1.5:1+ R:R on every trade\n• If you risked >1% of account, tighten sizing'
    if (pnl < 0) {
      const pct = account ? ((Math.abs(pnl) / account.initial_balance) * 100).toFixed(2) : '?'
      return '**' + sym + ' ' + side + ' — Loss**\n\nEntry: ' + entry + ' Exit: ' + exit + ' | ' + lev + 'x\nPNL: $' + pnl.toFixed(2) + '\n\n• Did price hit your pre-defined stop?\n• Were you with or against the HTF trend?\n• Loss = ' + pct + '% of initial balance'
    }
    return '**' + sym + ' ' + side + ' — Breakeven**\n\nBreakeven often signals hesitation or stops placed too tight. Did your thesis play out?'
  }

  if (lower.includes('position') || lower.includes('open trade')) {
    if (!positions || !positions.length) return 'No open positions. When you have active trades I can analyze your exposure and risk.'
    let resp = '**Open Positions (' + positions.length + ')**\n\n'
    positions.forEach(function(p) {
      const upnl = p.unrealized_pnl || p.pnl || 0
      resp += '• ' + (p.side || '').toUpperCase() + ' ' + p.symbol + ' @ $' + p.entry_price + ' | ' + p.leverage + 'x | UPNL: ' + (upnl >= 0 ? '+' : '') + '$' + upnl.toFixed(2) + (!p.stop_loss ? ' — NO SL' : '') + '\n'
    })
    if (positions.some(function(p) { return !p.stop_loss })) resp += '\nSet stop-losses on all open positions.'
    return resp
  }

  if (lower.includes('journal') || lower.includes('pattern') || lower.includes('history')) {
    if (!trades || !trades.length) return 'No trade history yet. Place some trades and I\'ll identify patterns in your performance.'
    const wins = trades.filter(t => (t.realized_pnl || t.pnl || 0) > 0)
    const losses = trades.filter(t => (t.realized_pnl || t.pnl || 0) < 0)
    const wr = ((wins.length / trades.length) * 100).toFixed(1)
    const avgW = wins.length ? (wins.reduce((s, t) => s + (t.realized_pnl || t.pnl || 0), 0) / wins.length).toFixed(2) : '0'
    const avgL = losses.length ? (Math.abs(losses.reduce((s, t) => s + (t.realized_pnl || t.pnl || 0), 0) / losses.length)).toFixed(2) : '0'
    const rr = losses.length && parseFloat(avgL) > 0 ? (parseFloat(avgW) / parseFloat(avgL)).toFixed(2) : 'N/A'
    const verdict = parseFloat(rr) >= 1.5 ? 'Healthy R:R — maintain this edge.' : parseFloat(rr) >= 1.0 ? 'Neutral R:R — widen TPs or tighten SLs.' : rr !== 'N/A' ? 'Avg loss > avg win — cut losers faster.' : ''
    return '**Trade Journal**\n\n' + trades.length + ' trades: **' + wr + '% win rate** (' + wins.length + 'W / ' + losses.length + 'L)\nAvg Win: +$' + avgW + ' | Avg Loss: -$' + avgL + ' | R:R: ' + rr + '\n\n' + verdict
  }

  if ((lower.includes('max') || lower.includes('safe')) && lower.includes('size')) {
    if (!account) return 'No active account found. Start a challenge to get position sizing guidance.'
    const bal = account.current_balance || 0
    const maxDD = account.max_total_drawdown || account.max_drawdown_limit || 0
    const used = Math.max(0, (account.initial_balance || 0) - bal)
    const left = maxDD - used
    const safe = Math.min(bal * 0.01, left * 0.2)
    return '**Max Safe Position Size**\n\nBalance: $' + bal.toLocaleString() + '\nDD Buffer Left: $' + left.toFixed(2) + '\n\n**Recommended**: $' + safe.toFixed(2) + '\n(1% of balance or 20% of DD buffer — whichever is lower)\n\nAt 5x that is a $' + (safe * 5).toFixed(2) + ' notional position.'
  }

  if (lower.includes('leverage')) {
    let resp = '**Leverage Guide**\n\n• Conservative (best): 3-5x\n• Moderate: 5-8x — high-conviction only\n• Avoid max leverage\n\n'
    if (account) resp += 'At $' + (account.current_balance || 0).toLocaleString() + ', 3x + 1% risk = ~$' + ((account.current_balance || 10000) * 0.03).toFixed(0) + ' max position.\n\n'
    resp += 'Size from your stop-loss distance first, then calculate leverage.'
    return resp
  }

  if (lower.includes('strategy') || lower.includes('setup')) {
    return '**Challenge Setups**\n\n1. **Trend Pullback**: 4H trend + pullback to 21 EMA + rejection candle\n2. **Range Breakout**: Consolidation breakout with volume, retest entry\n3. **Liquidity Sweep**: Sweep key level, sharp reversal, tight stop\n\n1-3 trades/day | 3-5x leverage | 0.5-1% risk | 1.5-2R target'
  }

  const tips = [
    '**Consistency Beats Performance**\n\n1% per week for 10 weeks beats 8% week 1 then giving it back. Prove process, not luck.',
    '**The 1% Rule**\n\nNever risk more than 1% per trade on a challenge. You need 6+ consecutive max losses to breach drawdown — that is selection, not variance.',
    '**Before Every Trade**\n\n1. What is the HTF trend?\n2. Where is the nearest liquidity?\n3. Is there a clear catalyst?\n\nCannot answer all three? The trade is not ready.',
    '**Overtrading Kills Challenges**\n\nMax 3 trades per day. All 3 losers? Done for the day. First 2 winners? Protect the gains and stop.',
  ]
  return tips[Math.floor(Math.random() * tips.length)]
}

// ─── Markdown renderer ────────────────────────────────────────────────────────
function renderMessage(text) {
  if (!text) return null
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

// ─── Quick prompts ────────────────────────────────────────────────────────────
const QP_ICONS = {
  riskCheck: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  drawdown: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  journal: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  maxSize: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
}

const QUICK_PROMPTS = [
  { iconKey: 'riskCheck', label: 'Risk Check', text: 'Give me a full risk assessment of my current account and open positions.' },
  { iconKey: 'drawdown',  label: 'Drawdown',   text: 'How close am I to my drawdown limits? What do I need to be careful about?' },
  { iconKey: 'journal',   label: 'Journal',    text: 'Analyze my recent trade history and tell me what patterns you see.' },
  { iconKey: 'maxSize',   label: 'Max Size',   text: 'What is the maximum safe position size I should open right now?' },
]

// ─── Component ────────────────────────────────────────────────────────────────
export default function FenixAssistant({ userId }) {
  useContext(ThemeContext) // subscribe to theme changes so CSS vars re-apply

  const [isOpen,    setIsOpen]     = useState(false)
  const [messages,  setMessages]   = useState([])
  const [input,     setInput]      = useState('')
  const [isTyping,  setIsTyping]   = useState(false)
  const [account,   setAccount]    = useState(null)
  const [trades,    setTrades]     = useState([])
  const [positions, setPositions]  = useState([])
  const [usage,     setUsageState] = useState(getUsage)
  const [pulse,     setPulse]      = useState(false)
  const [dataReady, setDataReady]  = useState(false)

  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(true)
      setTimeout(() => setPulse(false), 900)
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  const loadData = useCallback(async () => {
    if (!userId || dataReady) return
    try {
      const state = await getAccountState(userId)
      setAccount(state.account || null)
      setPositions(state.positions || [])
      if (state.account?.id) {
        const { data } = await supabase
          .from('demo_trades')
          .select('*')
          .eq('demo_account_id', state.account.id)
          .eq('is_close', true)
          .order('executed_at', { ascending: false })
          .limit(50)
        setTrades(data || [])
      }
    } catch (err) {
      console.warn('[FENIX] data load error:', err)
    } finally {
      setDataReady(true)
    }
  }, [userId, dataReady])

  useEffect(() => {
    if (isOpen) {
      loadData()
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen, loadData])

  useEffect(() => {
    if (isOpen && dataReady && messages.length === 0) {
      const bal = account?.current_balance
      const used = account ? Math.max(0, (account.initial_balance || 0) - (account.current_balance || 0)) : 0
      const maxDD = account?.max_total_drawdown || account?.max_drawdown_limit || 1
      const ddPct = ((used / maxDD) * 100).toFixed(0)
      setMessages([{
        role: 'assistant',
        content: account
          ? 'Fenix online. Balance **$' + (bal || 0).toLocaleString() + '**, max drawdown **' + ddPct + '%** consumed, **' + positions.length + '** open position' + (positions.length !== 1 ? 's' : '') + '.\n\nWhat do you need?'
          : 'Fenix online. No active challenge detected — start one from the Dashboard to unlock full analysis.\n\nI can still answer general trading questions.',
      }])
    }
  }, [isOpen, dataReady]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const sendMessage = useCallback(async (text) => {
    const trimmed = (text || input).trim()
    if (!trimmed || isTyping) return

    if (!isCryptoRelated(trimmed)) {
      setMessages(prev => [...prev,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: "I'm focused on crypto trading analysis. Ask me about your positions, drawdown, risk, or trade history." },
      ])
      setInput('')
      return
    }

    const currentUsage = getUsage()
    if (currentUsage.count >= MAX_FREE) {
      setMessages(prev => [...prev,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: 'You have used all ' + MAX_FREE + ' free queries this week. Usage resets every Monday.\n\nUpgrade to Pro for unlimited Fenix access.' },
      ])
      setInput('')
      return
    }

    const newMessages = [...messages, { role: 'user', content: trimmed }]
    setMessages(newMessages)
    setInput('')
    setIsTyping(true)

    try {
      const ctx = buildTradingContext(account, trades, positions)
      const apiResp = await callAI(newMessages, ctx)
      if (apiResp) {
        setMessages(prev => [...prev, { role: 'assistant', content: apiResp }])
      } else {
        await new Promise(r => setTimeout(r, 400 + Math.random() * 300))
        setMessages(prev => [...prev, { role: 'assistant', content: generateLocalResponse(trimmed, account, trades, positions) }])
      }
      const newCount = currentUsage.count + 1
      saveUsage(newCount)
      setUsageState({ count: newCount, weekStart: getWeekStart() })
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: generateLocalResponse(trimmed, account, trades, positions) }])
    } finally {
      setIsTyping(false)
    }
  }, [input, isTyping, messages, account, trades, positions])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const usedDD    = account ? Math.max(0, (account.initial_balance || 0) - (account.current_balance || 0)) : 0
  const maxDDval  = account?.max_total_drawdown || account?.max_drawdown_limit || 1
  const dailyLoss = account?.daily_loss || 0
  const dailyDDval = account?.daily_drawdown_limit || 1
  const ddPct     = (usedDD / maxDDval) * 100
  const dailyPct  = (dailyLoss / dailyDDval) * 100
  const riskLevel = ddPct > 70 ? 'CRITICAL' : ddPct > 40 ? 'CAUTION' : 'SAFE'
  const riskColor = riskLevel === 'CRITICAL' ? '#ef4444' : riskLevel === 'CAUTION' ? '#f59e0b' : '#10b981'
  const openPnl   = positions.reduce((s, p) => s + (p.unrealized_pnl || p.pnl || 0), 0)
  const queriesLeft = Math.max(0, MAX_FREE - usage.count)
  const ddColor = (pct) => pct > 70 ? '#ef4444' : pct > 40 ? '#f59e0b' : '#10b981'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');

        .fenix-fab {
          position: fixed; bottom: 24px; right: 24px;
          width: 54px; height: 54px; border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 18px rgba(124,58,237,0.38);
          transition: transform 0.2s, box-shadow 0.2s;
          z-index: 1100;
        }
        .fenix-fab:hover { transform: scale(1.07); box-shadow: 0 6px 26px rgba(124,58,237,0.52); }
        .fenix-fab.fenix-pulse { animation: fenixFabPulse 0.9s ease-out; }
        @keyframes fenixFabPulse {
          0%   { box-shadow: 0 0 0 0   rgba(124,58,237,0.52), 0 4px 18px rgba(124,58,237,0.38); }
          100% { box-shadow: 0 0 0 16px rgba(124,58,237,0),   0 4px 18px rgba(124,58,237,0.38); }
        }
        .fenix-fab svg { width: 22px; height: 22px; }
        .fenix-risk-dot {
          position: absolute; top: 2px; right: 2px;
          width: 11px; height: 11px; border-radius: 50%;
          border: 2px solid var(--bg-primary);
          animation: fenixDotBlink 2s ease-in-out infinite;
        }
        @keyframes fenixDotBlink { 0%,100%{opacity:1} 50%{opacity:0.4} }

        .fenix-panel {
          position: fixed; bottom: 90px; right: 16px;
          width: min(400px, calc(100vw - 32px));
          height: min(600px, calc(100dvh - 116px));
          background: var(--bg-card-solid);
          border: 1px solid var(--border-color);
          border-radius: 18px;
          display: flex; flex-direction: column; overflow: hidden;
          box-shadow: 0 20px 56px rgba(0,0,0,0.3), 0 0 0 1px rgba(124,58,237,0.15);
          z-index: 1099;
          animation: fenixPanelIn 0.22s cubic-bezier(0.34,1.56,0.64,1);
          transform-origin: bottom right;
        }
        @keyframes fenixPanelIn {
          from { opacity:0; transform:scale(0.88) translateY(14px); }
          to   { opacity:1; transform:scale(1)    translateY(0); }
        }
        body[data-theme="day"] .fenix-panel {
          box-shadow: 0 12px 40px rgba(0,0,0,0.10), 0 0 0 1px rgba(124,58,237,0.13);
        }

        .fenix-header {
          padding: 13px 15px;
          background: linear-gradient(135deg, rgba(124,58,237,0.11), rgba(79,70,229,0.06));
          border-bottom: 1px solid var(--border-color);
          display: flex; align-items: center; gap: 10px; flex-shrink: 0;
        }
        .fenix-av {
          width: 33px; height: 33px; border-radius: 9px;
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; flex-shrink: 0;
        }
        .fenix-name {
          font-family: 'Syne', sans-serif; font-weight: 800; font-size: 13.5px;
          color: var(--text-primary); letter-spacing: 0.04em;
        }
        .fenix-sub {
          font-family: 'Space Mono', monospace; font-size: 8.5px;
          color: var(--text-muted); margin-top: 1px;
        }
        .fenix-risk-badge {
          font-family: 'Space Mono', monospace; font-size: 8px; font-weight: 700;
          letter-spacing: 0.1em; padding: 2px 7px; border-radius: 4px;
          text-transform: uppercase; flex-shrink: 0;
        }
        .fenix-close-btn {
          width: 26px; height: 26px; border-radius: 7px;
          background: var(--border-color); border: none; cursor: pointer;
          color: var(--text-muted); display: flex; align-items: center;
          justify-content: center; font-size: 15px; line-height: 1;
          transition: background 0.15s, color 0.15s; flex-shrink: 0;
        }
        .fenix-close-btn:hover { background: var(--bg-card-hover); color: var(--text-primary); }

        .fenix-stats {
          display: grid; grid-template-columns: repeat(3,1fr);
          gap: 1px; background: var(--border-color);
          border-bottom: 1px solid var(--border-color); flex-shrink: 0;
        }
        .fenix-stat-cell { padding: 8px 11px; background: var(--bg-card-solid); }
        .fenix-stat-lbl {
          font-family: 'Space Mono', monospace; font-size: 8px;
          color: var(--text-muted); text-transform: uppercase;
          letter-spacing: 0.08em; margin-bottom: 2px;
        }
        .fenix-stat-val {
          font-family: 'Space Mono', monospace; font-size: 11px;
          font-weight: 700; color: var(--text-primary);
        }

        .fenix-dd-wrap {
          padding: 8px 13px; border-bottom: 1px solid var(--border-color);
          display: flex; flex-direction: column; gap: 5px;
          flex-shrink: 0; background: var(--bg-secondary);
        }
        .fenix-dd-row { display: flex; align-items: center; gap: 8px; }
        .fenix-dd-lbl {
          font-family: 'Space Mono', monospace; font-size: 8px;
          color: var(--text-muted); width: 30px; flex-shrink: 0;
        }
        .fenix-dd-track {
          flex: 1; height: 3px; background: var(--border-color);
          border-radius: 2px; overflow: hidden;
        }
        .fenix-dd-fill { height: 100%; border-radius: 2px; transition: width 0.5s ease; }
        .fenix-dd-pct {
          font-family: 'Space Mono', monospace; font-size: 8px;
          width: 26px; text-align: right; flex-shrink: 0;
        }

        .fenix-messages {
          flex: 1; overflow-y: auto; padding: 13px;
          display: flex; flex-direction: column; gap: 9px;
          scrollbar-width: thin; scrollbar-color: var(--border-color) transparent;
        }
        .fenix-msg { display: flex; gap: 7px; animation: fenixMsgIn 0.18s ease; }
        @keyframes fenixMsgIn {
          from { opacity:0; transform:translateY(5px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .fenix-msg.user { flex-direction: row-reverse; }
        .fenix-msg-av {
          width: 25px; height: 25px; border-radius: 7px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; align-self: flex-end;
        }
        .fenix-msg-av.ai-av {
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
        }
        .fenix-msg-av.user-av {
          background: var(--border-color); font-family: 'Space Mono', monospace;
          font-size: 8.5px; color: var(--text-muted);
        }
        .fenix-bubble {
          max-width: 84%; padding: 8px 11px; border-radius: 12px;
          font-family: 'Space Mono', monospace; font-size: 11px;
          line-height: 1.65; word-break: break-word;
        }
        .fenix-msg.assistant .fenix-bubble {
          background: rgba(124,58,237,0.07); border: 1px solid rgba(124,58,237,0.16);
          color: var(--text-primary); border-bottom-left-radius: 3px;
        }
        .fenix-msg.user .fenix-bubble {
          background: var(--bg-card-hover); border: 1px solid var(--border-color);
          color: var(--text-secondary); border-bottom-right-radius: 3px;
        }
        body[data-theme="day"] .fenix-msg.assistant .fenix-bubble {
          background: rgba(124,58,237,0.05); border-color: rgba(124,58,237,0.18);
        }

        .fenix-typing { display: flex; gap: 4px; align-items: center; padding: 6px 2px; }
        .fenix-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: rgba(124,58,237,0.5);
          animation: fenixDot 1.2s ease-in-out infinite;
        }
        .fenix-dot:nth-child(2) { animation-delay:0.2s }
        .fenix-dot:nth-child(3) { animation-delay:0.4s }
        @keyframes fenixDot {
          0%,100%{ transform:translateY(0); opacity:0.4; }
          50%    { transform:translateY(-4px); opacity:1; }
        }

        .fenix-quick {
          padding: 6px 10px; display: flex; gap: 5px;
          overflow-x: auto; flex-shrink: 0;
          border-top: 1px solid var(--border-color); scrollbar-width: none;
        }
        .fenix-quick::-webkit-scrollbar { display: none; }
        .fenix-qp-btn {
          flex-shrink: 0; padding: 4px 9px; border-radius: 6px;
          background: rgba(124,58,237,0.07); border: 1px solid rgba(124,58,237,0.16);
          color: var(--text-secondary); font-family: 'Space Mono', monospace;
          font-size: 9px; cursor: pointer; white-space: nowrap;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
          display: flex; align-items: center; gap: 4px;
        }
        .fenix-qp-btn:hover:not(:disabled) {
          background: rgba(124,58,237,0.14); border-color: rgba(124,58,237,0.32);
          color: var(--text-primary);
        }
        .fenix-qp-btn:disabled { opacity: 0.38; cursor: not-allowed; }

        .fenix-input-row {
          padding: 9px 11px; border-top: 1px solid var(--border-color);
          display: flex; gap: 7px; align-items: flex-end;
          flex-shrink: 0; background: var(--bg-secondary);
        }
        .fenix-input {
          flex: 1; background: var(--bg-card); border: 1px solid var(--border-color);
          border-radius: 9px; padding: 8px 10px; color: var(--text-primary);
          font-family: 'Space Mono', monospace; font-size: 11px;
          resize: none; outline: none; transition: border-color 0.15s;
          min-height: 35px; max-height: 88px; line-height: 1.5;
        }
        .fenix-input:focus { border-color: rgba(124,58,237,0.42); }
        .fenix-input::placeholder { color: var(--text-muted); }
        .fenix-send-btn {
          width: 35px; height: 35px; border-radius: 9px;
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          border: none; cursor: pointer; display: flex; align-items: center;
          justify-content: center; flex-shrink: 0;
          transition: filter 0.15s, transform 0.15s;
        }
        .fenix-send-btn:hover:not(:disabled) { filter: brightness(1.1); transform: scale(1.04); }
        .fenix-send-btn:disabled { opacity: 0.36; cursor: not-allowed; transform: none; }
        .fenix-send-btn svg { width: 14px; height: 14px; }

        .fenix-disclaimer {
          padding: 6px 14px 2px; text-align: center;
          font-family: 'Space Mono', monospace; font-size: 8px;
          color: var(--text-muted); flex-shrink: 0;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border-color);
          line-height: 1.5;
        }
        .fenix-footer {
          padding: 3px 0 6px; text-align: center;
          font-family: 'Space Mono', monospace; font-size: 8.5px;
          color: var(--text-muted); flex-shrink: 0; background: var(--bg-secondary);
        }

        @media (max-width: 480px) {
          .fenix-fab { bottom: 16px; right: 16px; width: 50px; height: 50px; }
          .fenix-panel {
            bottom: 78px; right: 8px; left: 8px; width: auto;
            height: min(580px, calc(100dvh - 104px)); border-radius: 16px;
          }
          .fenix-bubble { font-size: 10.5px; }
          .fenix-stat-val { font-size: 10px; }
        }
      `}</style>

      <button
        className={'fenix-fab' + (pulse ? ' fenix-pulse' : '')}
        onClick={() => setIsOpen(function(o) { return !o })}
        aria-label="Open Fenix AI Assistant"
        title="Fenix AI Trading Assistant"
      >
        {isOpen ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="2"/>
            <rect x="9" y="9" width="6" height="6"/>
            <path d="M9 2v2M15 2v2M9 20v2M15 20v2M20 9h2M20 15h2M2 9h2M2 15h2"/>
          </svg>
        )}
        <span className="fenix-risk-dot" style={{ background: account ? riskColor : '#6b7280' }} />
      </button>

      {isOpen && (
        <div className="fenix-panel" role="dialog" aria-label="Fenix AI Assistant">
          <div className="fenix-header">
            <div className="fenix-av">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L15.5 8.5L22 9.5L17 14.5L18.5 21L12 17.5L5.5 21L7 14.5L2 9.5L8.5 8.5L12 2Z" fill="white" fillOpacity="0.9" stroke="white" strokeWidth="0.5" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="3" fill="white" fillOpacity="0.3"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="fenix-name">Fenix</div>
              <div className="fenix-sub">AI TRADING ANALYST · IJGF</div>
            </div>
            {account && (
              <span className="fenix-risk-badge" style={{
                background: riskColor + '14', color: riskColor, border: '1px solid ' + riskColor + '35',
              }}>
                {riskLevel}
              </span>
            )}
            <button className="fenix-close-btn" onClick={() => setIsOpen(false)} aria-label="Close Fenix">×</button>
          </div>

          <div className="fenix-stats">
            <div className="fenix-stat-cell">
              <div className="fenix-stat-lbl">Balance</div>
              <div className="fenix-stat-val" style={{ color: '#10b981' }}>
                {account ? '$' + (account.current_balance || 0).toLocaleString() : '—'}
              </div>
            </div>
            <div className="fenix-stat-cell">
              <div className="fenix-stat-lbl">Open P&L</div>
              <div className="fenix-stat-val" style={{ color: openPnl >= 0 ? '#10b981' : '#ef4444' }}>
                {positions.length > 0 ? (openPnl >= 0 ? '+' : '') + '$' + openPnl.toFixed(2) : '—'}
              </div>
            </div>
            <div className="fenix-stat-cell">
              <div className="fenix-stat-lbl">Positions</div>
              <div className="fenix-stat-val">{positions.length} open</div>
            </div>
          </div>

          {account && (
            <div className="fenix-dd-wrap">
              {[{ label: 'Daily', pct: dailyPct }, { label: 'Max', pct: ddPct }].map(function(item) {
                return (
                  <div className="fenix-dd-row" key={item.label}>
                    <div className="fenix-dd-lbl">{item.label}</div>
                    <div className="fenix-dd-track">
                      <div className="fenix-dd-fill" style={{ width: Math.min(item.pct, 100) + '%', background: ddColor(item.pct) }} />
                    </div>
                    <div className="fenix-dd-pct" style={{ color: ddColor(item.pct) }}>{item.pct.toFixed(0)}%</div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="fenix-messages">
            {messages.map(function(m, i) {
              return (
                <div key={i} className={'fenix-msg ' + m.role}>
                  <div className={'fenix-msg-av ' + (m.role === 'assistant' ? 'ai-av' : 'user-av')}>
                    {m.role === 'assistant' ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L15.5 8.5L22 9.5L17 14.5L18.5 21L12 17.5L5.5 21L7 14.5L2 9.5L8.5 8.5L12 2Z" fill="white" fillOpacity="0.9" strokeLinejoin="round"/>
                    </svg>
                  ) : 'U'}
                  </div>
                  <div className="fenix-bubble">
                    {m.role === 'assistant' ? renderMessage(m.content) : m.content}
                  </div>
                </div>
              )
            })}
            {isTyping && (
              <div className="fenix-msg assistant">
                <div className="fenix-msg-av ai-av">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L15.5 8.5L22 9.5L17 14.5L18.5 21L12 17.5L5.5 21L7 14.5L2 9.5L8.5 8.5L12 2Z" fill="white" fillOpacity="0.9" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="fenix-bubble">
                  <div className="fenix-typing">
                    <div className="fenix-dot"/><div className="fenix-dot"/><div className="fenix-dot"/>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          <div className="fenix-quick">
            {QUICK_PROMPTS.map(function(qp, i) {
              return (
                <button key={i} className="fenix-qp-btn" onClick={() => sendMessage(qp.text)} disabled={isTyping}>
                  {QP_ICONS[qp.iconKey]}{qp.label}
                </button>
              )
            })}
          </div>

          <div className="fenix-input-row">
            <textarea
              ref={inputRef}
              className="fenix-input"
              placeholder="Ask about your trades, risk, strategy..."
              value={input}
              onChange={function(e) { setInput(e.target.value) }}
              onKeyDown={handleKey}
              rows={1}
              disabled={isTyping}
            />
            <button
              className="fenix-send-btn"
              onClick={() => sendMessage()}
              disabled={isTyping || !input.trim()}
              aria-label="Send message"
            >
              <svg viewBox="0 0 24 24" fill="white">
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>

          <div className="fenix-disclaimer">
            Fenix AI can make mistakes. Always verify analysis before trading.
          </div>
          <div className="fenix-footer">
            {queriesLeft} / {MAX_FREE} free queries left this week
          </div>
        </div>
      )}
    </>
  )
}
