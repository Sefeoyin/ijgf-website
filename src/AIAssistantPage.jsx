import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import { getAccountState } from './tradingService'

// ─── Weekly usage tracking ───────────────────────────────────────────────────
const STORAGE_KEY = 'ijgf_ai_usage'
const MAX_FREE = 5

function getUsage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { count: 0, weekStart: getWeekStart() }
    const data = JSON.parse(raw)
    if (data.weekStart !== getWeekStart()) return { count: 0, weekStart: getWeekStart() }
    return data
  } catch { return { count: 0, weekStart: getWeekStart() } }
}
function setUsage(count) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ count, weekStart: getWeekStart() }))
}
function getWeekStart() {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d.setDate(diff))
  return mon.toISOString().slice(0, 10)
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
  'dca','dollar cost','hedge','scalp','swing','day trade','timeframe','pattern',
  'fibonacci','bollinger','atr','momentum','divergence','consolidation',
  'whale','token','defi','dex','cex','staking','yield','apr','apy',
  'fee','slippage','spread','depth','orderbook','ta','technical analysis',
  'hi','hello','hey','good','morning','evening','thanks','thank',
  'what can you','who are you'
]

function isCryptoRelated(text) {
  const lower = text.toLowerCase()
  if (lower.length < 20) return true
  return CRYPTO_KEYWORDS.some(kw => lower.includes(kw))
}

// ─── Build trading context for AI ────────────────────────────────────────────
function buildTradingContext(account, trades, positions) {
  const parts = []
  if (account) {
    parts.push('ACCOUNT: Balance $' + (account.current_balance || 0).toLocaleString() +
      ' / Initial $' + (account.initial_balance || 0).toLocaleString() +
      ' | PNL $' + ((account.current_balance || 0) - (account.initial_balance || 0)).toFixed(2) +
      ' | Win Rate ' + (account.total_trades > 0 ? ((account.winning_trades / account.total_trades) * 100).toFixed(1) : '0') + '%' +
      ' | Trades ' + (account.total_trades || 0) + ' (' + (account.winning_trades || 0) + 'W/' + (account.losing_trades || 0) + 'L)' +
      ' | Target $' + (account.profit_target || 0) + ' | Max DD $' + (account.max_total_drawdown || 0) +
      ' | Status ' + (account.status || 'active'))
  }
  if (positions && positions.length > 0) {
    parts.push('OPEN POSITIONS:')
    positions.forEach(p => {
      parts.push('- ' + (p.side || '').toUpperCase() + ' ' + p.symbol + ' @ $' + p.entry_price + ' | ' + p.leverage + 'x | UPNL $' + (p.unrealized_pnl || 0).toFixed(2) +
        (p.take_profit ? ' TP $' + p.take_profit : '') + (p.stop_loss ? ' SL $' + p.stop_loss : ''))
    })
  }
  if (trades && trades.length > 0) {
    const recent = trades.slice(0, 10)
    parts.push('RECENT TRADES (' + recent.length + '):')
    recent.forEach(t => {
      const pnl = t.realized_pnl || 0
      parts.push('- ' + (t.side || '').toUpperCase() + ' ' + t.symbol + ' Entry $' + t.entry_price + ' Exit $' + t.exit_price + ' PNL ' + (pnl >= 0 ? '+' : '') + '$' + pnl.toFixed(2) + ' ' + t.leverage + 'x ' + new Date(t.executed_at).toLocaleDateString())
    })
    const wins = trades.filter(t => (t.realized_pnl || 0) > 0)
    const losses = trades.filter(t => (t.realized_pnl || 0) < 0)
    const avgW = wins.length > 0 ? wins.reduce((s, t) => s + t.realized_pnl, 0) / wins.length : 0
    const avgL = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.realized_pnl, 0) / losses.length) : 0
    parts.push('STATS: Avg Win $' + avgW.toFixed(2) + ' | Avg Loss $' + avgL.toFixed(2) + ' | R:R ' + (avgL > 0 ? (avgW / avgL).toFixed(2) : 'N/A'))
  }
  return parts.join('\n') || 'No trading data available yet.'
}

// ─── AI system prompt ────────────────────────────────────────────────────────
const SYSTEM_PROMPT = 'You are the IJGF AI Trading Assistant — a professional crypto trading analyst embedded in a prop trading challenge platform.\n\nPERSONALITY: Direct, data-driven, actionable. Like a senior trader mentoring a junior. Reference the trader\'s actual data when available. Use markdown bold (**text**) for emphasis.\n\nPLATFORM RULES:\n- Profit Target: 10% of initial balance\n- Daily Loss Limit: 4%\n- Max Overall Drawdown: 6% (static)\n- Max Leverage: 8x BTC/ETH, 5x altcoins\n- Profit Split: 80% when funded\n- No time limit\n\nGUIDELINES:\n1. Reference specific trades/stats when data exists\n2. Give concrete advice with numbers\n3. Keep responses under 200 words unless detailed analysis requested\n4. Frame as educational, not financial advice\n5. Always find areas to optimize'

// ─── Call AI via Supabase Edge Function ──────────────────────────────────────
async function callAI(messages, tradingContext) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const systemMsg = SYSTEM_PROMPT + '\n\nTRADER DATA:\n' + tradingContext

  try {
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const res = await fetch(supabaseUrl + '/functions/v1/ai-assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({
        system: systemMsg,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    })

    if (!res.ok) throw new Error('API ' + res.status)
    const data = await res.json()
    return data.content || data.message || data.text || null
  } catch (err) {
    console.warn('AI API unavailable, using local engine:', err.message)
    return null
  }
}

// ─── Enhanced local response engine ──────────────────────────────────────────
function generateLocalResponse(message, account, trades, positions) {
  const lower = message.toLowerCase()

  if (lower.match(/^(hi|hello|hey|good morning|good evening|sup|what's up|what can you)/)) {
    let resp = 'Hey! I\'m your AI trading assistant. I can help with:\n\n'
    resp += '• **Trade Analysis** — "Analyze my last trade"\n'
    resp += '• **Risk Review** — "Review my risk management"\n'
    resp += '• **Position Check** — "How are my open positions?"\n'
    resp += '• **Strategy** — "What setups work best?"\n'
    resp += '• **Market Analysis** — Ask about BTC, ETH, or any pair\n'
    if (account) {
      const wr = account.total_trades ? ((account.winning_trades / account.total_trades) * 100).toFixed(0) : '0'
      resp += '\nYour account: $' + (account.current_balance || 0).toLocaleString() + ' | ' + wr + '% win rate | ' + (account.total_trades || 0) + ' trades'
    }
    return resp
  }

  if (lower.includes('analyze') && (lower.includes('last trade') || lower.includes('recent trade'))) {
    if (!trades || !trades.length) return 'No closed trades found yet. Start trading and I\'ll analyze your entries, exits, and risk management.'
    const last = trades[0]
    const pnl = last.realized_pnl || 0
    const sym = last.symbol || 'BTCUSDT'
    const side = (last.side || 'LONG').toUpperCase()
    const entry = last.entry_price ? '$' + Number(last.entry_price).toLocaleString() : 'N/A'
    const exit = last.exit_price ? '$' + Number(last.exit_price).toLocaleString() : 'N/A'
    const lev = last.leverage || 1
    if (pnl > 0) return '**' + sym + ' ' + side + ' — Profitable ✅**\n\nEntry: ' + entry + ' → Exit: ' + exit + ' | ' + lev + 'x\nPNL: +$' + pnl.toFixed(2) + '\n\n• Was this your planned entry or did you chase?\n• Compare risk vs reward — aim for 1.5:1+ R:R\n• If you risked >1% of account, tighten sizing on similar setups'
    if (pnl < 0) {
      const pct = account ? ((Math.abs(pnl) / account.initial_balance) * 100).toFixed(2) : '?'
      return '**' + sym + ' ' + side + ' — Loss ⚠️**\n\nEntry: ' + entry + ' → Exit: ' + exit + ' | ' + lev + 'x\nPNL: $' + pnl.toFixed(2) + '\n\n• Did price hit your pre-defined stop or manual close?\n• Were you with or against the HTF trend?\n• Was ' + lev + 'x appropriate for the volatility?\n• Loss = ' + pct + '% of initial balance'
    }
    return '**' + sym + ' ' + side + ' — Breakeven**\n\nEntry: ' + entry + ' → Exit: ' + exit + '\n\nBreakeven trades often indicate hesitation or stops placed too tight. Review if your thesis played out.'
  }

  if (lower.includes('risk management') || lower.includes('review my risk')) {
    if (!trades || !trades.length) return 'No trade history yet. Place some trades and I\'ll review your sizing, drawdown, and consistency.'
    const wins = trades.filter(t => (t.realized_pnl || 0) > 0)
    const losses = trades.filter(t => (t.realized_pnl || 0) < 0)
    const wr = ((wins.length / trades.length) * 100).toFixed(1)
    const avgW = wins.length ? (wins.reduce((s, t) => s + t.realized_pnl, 0) / wins.length).toFixed(2) : '0'
    const avgL = losses.length ? (Math.abs(losses.reduce((s, t) => s + t.realized_pnl, 0) / losses.length)).toFixed(2) : '0'
    const rr = losses.length && parseFloat(avgL) > 0 ? (parseFloat(avgW) / parseFloat(avgL)).toFixed(2) : 'N/A'
    let advice = ''
    if (parseFloat(rr) >= 1.5) advice = '✅ Healthy R:R. Maintain this edge.'
    else if (parseFloat(rr) >= 1.0) advice = '⚠️ Neutral R:R — widen take-profits or tighten stops.'
    else if (rr !== 'N/A') advice = '🚨 Avg loss > avg win. Cut losers faster, let winners run.'
    let dd = ''
    if (account) dd = '\n\nDrawdown: $' + Math.max(0, account.initial_balance - account.current_balance).toFixed(2) + ' of $' + account.max_total_drawdown + ' max'
    return '**Risk Report 📊**\n\n' + trades.length + ' trades: ' + wr + '% win rate (' + wins.length + 'W / ' + losses.length + 'L)\nAvg Win: +$' + avgW + ' | Avg Loss: -$' + avgL + ' | R:R: ' + rr + '\n\n' + advice + dd
  }

  if (lower.includes('position') || lower.includes('open trade') || lower.includes('current trade')) {
    if (!positions || !positions.length) return 'No open positions. When you have active trades, I can analyze exposure and risk levels.'
    let resp = '**Open Positions (' + positions.length + ')**\n\n'
    positions.forEach(function(p) {
      const upnl = p.unrealized_pnl || 0
      resp += '• ' + (p.side || '').toUpperCase() + ' ' + p.symbol + ' @ $' + p.entry_price + ' | ' + p.leverage + 'x | UPNL: ' + (upnl >= 0 ? '+' : '') + '$' + upnl.toFixed(2) + (p.stop_loss ? '' : ' ⚠️ No SL') + '\n'
    })
    if (positions.some(function(p) { return !p.stop_loss })) resp += '\n🚨 Set stop-losses on all positions!'
    return resp
  }

  if (lower.includes('today') || lower.includes('lose money') || lower.includes('why did i')) {
    var today = new Date().toDateString()
    var todayT = (trades || []).filter(function(t) { return new Date(t.executed_at).toDateString() === today })
    if (!todayT.length) return 'No trades recorded today. Unrealized losses show once closed.'
    var todayPnl = todayT.reduce(function(s, t) { return s + (t.realized_pnl || 0) }, 0)
    if (todayPnl < 0) return '**Today: ' + todayT.length + ' trades | PNL: $' + todayPnl.toFixed(2) + '**\n\nCommon causes: trading against HTF trend, overleveraging, revenge trading, entering without edge.' + (Math.abs(todayPnl) > (account ? account.initial_balance : 10000) * 0.02 ? '\n\n⚠️ Consider stopping for the day.' : '')
    return '**Today: ' + todayT.length + ' trades | PNL: +$' + todayPnl.toFixed(2) + '**\n\nSolid day. Don\'t give back profits by overtrading.'
  }

  if (lower.includes('win rate') || lower.includes('improve my win')) {
    return '**Improving Win Rate**\n\n1. **Score each setup**: Catalyst? R:R ≥ 1.5:1? With HTF trend? Only trade if all pass.\n2. **Reduce frequency** — 2-3 high-conviction > 10 mediocre\n3. **Time entries** — first 2 hours after US open\n4. **Avoid counter-trend** unless clear 4H structure break\n5. **Journal weekly** — patterns in losers reveal your edge leak'
  }

  if (lower.includes('strategy') || lower.includes('best setup') || lower.includes('recommend')) {
    return '**Challenge Trading Setups**\n\n1. **Trend Pullback**: 4H trend + pullback to 21 EMA + rejection candle\n2. **Range Breakout**: Consolidation → breakout with volume → retest entry\n3. **Liquidity Sweep**: Sweep key level → sharp reversal → tight stop\n\n**Settings**: 1-3 trades/day, 3-5x leverage, 0.5-1% risk, 1.5-2R target.'
  }

  if (lower.includes('leverage')) {
    var leverageResp = '**Leverage Guide**\n\n• **Conservative (best)**: 3-5x\n• **Moderate**: 5-8x — high-conviction only\n• **Avoid**: Max leverage\n\n'
    if (account) leverageResp += 'At $' + (account.current_balance || 0).toLocaleString() + ', 3x and 1% risk = ~$' + ((account.current_balance || 10000) * 0.03).toFixed(0) + ' max position.\n\n'
    leverageResp += 'Size from stop-loss distance, then calculate leverage — not the reverse.'
    return leverageResp
  }

  if (lower.includes('drawdown')) {
    var used = account ? Math.max(0, account.initial_balance - account.current_balance) : 0
    var ddResp = '**Drawdown Management**\n\n'
    if (account) ddResp += 'Current: $' + used.toFixed(2) + ' / $' + account.max_total_drawdown + ' (' + ((used / account.max_total_drawdown) * 100).toFixed(1) + '%)\n\n'
    ddResp += '• Stop at 2% daily (half your 4% limit)\n• 2 consecutive losses → step away 2 hours\n• Never revenge trade\n• Scale down 50% after losses\n• If 3%+ weekly drawdown, go minimum size'
    return ddResp
  }

  if (lower.includes('btc') || lower.includes('bitcoin')) {
    return '**BTC Analysis**\n\nBTC leads crypto — alts follow with 2-3x amplified moves.\n\n**Watch**: Daily/weekly highs+lows, $5k round numbers, volume POC\n**Rule**: Check BTC 1H/4H before any alt trade\n**Best setup**: 4H 21 EMA bounce with volume in trending markets'
  }

  if (lower.includes('stop loss') || lower.includes('take profit')) {
    return '**SL/TP Guide**\n\n**Stop Loss**: Set at thesis invalidation (structure break). For longs: below swing low. Never widen after entry.\n\n**Take Profit**: Next liquidity level. Min 1.5:1 R:R. Partial at 1R, trail rest.\n\nYour 4% daily limit means a single trade without stops can end your day.'
  }

  var tips = [
    '**Consistency Beats Performance**\n\n1% per week for 10 weeks > 8% week 1 then giving half back. Prove process, not luck.',
    '**The 2% Rule**\n\nNever risk >2% per trade. For challenges, aim 0.5-1%. With proper sizing, 10+ consecutive losses to breach drawdown — that\'s trade selection, not luck.',
    '**Before Every Trade**\n\n3 questions:\n1. What\'s the HTF trend?\n2. Where\'s the nearest liquidity pool?\n3. Is there a clear catalyst?\n\nCan\'t answer all three? The trade isn\'t ready.',
    '**Overtrading Kills Challenges**\n\nMax 3 trades/day. All 3 losers? Done for the day. First 2 winners? Consider stopping — protect gains.',
    '**Funding Rate Matters**\n\nHolding perps overnight in high funding (>0.05%) eats PNL silently. High positive funding = bias shorts. High negative = look for squeeze setups.',
  ]
  return tips[Math.floor(Math.random() * tips.length)]
}

// ─── Feature cards ───────────────────────────────────────────────────────────
const FEATURES = [
  { title: 'Trade Analysis', desc: 'Break down trades — entries, exits, and improvement areas.', icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>) },
  { title: 'Risk Insights', desc: 'Identify overexposure, drawdown risks, and sizing issues.', icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>) },
  { title: 'Performance Patterns', desc: "Spot what's working and what's holding you back.", icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>) },
  { title: 'Strategy Coach', desc: 'Data-backed suggestions for your style and pairs.', icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>) },
]

const SUGGESTED = [
  'Analyze my last trade',
  'Review my risk management',
  'How are my open positions?',
  'What setups work best for challenges?',
  'How can I improve my win rate?',
]

// ─── Markdown-lite renderer ──────────────────────────────────────────────────
function renderMessage(text) {
  if (!text) return null
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function AIAssistantPage({ userName, subscribed: initialSubscribed, userId }) {
  const [subscribed, setSubscribed] = useState(initialSubscribed ?? false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [usage, setUsageState] = useState(() => getUsage())
  const [topicError, setTopicError] = useState('')
  const [account, setAccount] = useState(null)
  const [trades, setTrades] = useState([])
  const [positions, setPositions] = useState([])
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const firstName = (userName || 'Trader').split(' ')[0]

  useEffect(() => {
    if (!userId) return
    const load = async () => {
      try {
        const state = await getAccountState(userId)
        setAccount(state.account)
        setPositions(state.positions || [])
        if (state.account?.id) {
          const { data } = await supabase
            .from('demo_trades')
            .select('*')
            .eq('demo_account_id', state.account.id)
            .order('executed_at', { ascending: false })
            .limit(50)
          setTrades(data || [])
        }
      } catch (err) {
        console.warn('Could not load trading data:', err)
      }
    }
    load()
  }, [userId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const remaining = MAX_FREE - (subscribed ? 0 : usage.count)
  const limitReached = !subscribed && usage.count >= MAX_FREE

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || limitReached) return

    if (!isCryptoRelated(trimmed)) {
      setTopicError("I'm focused on crypto trading. Ask about trades, risk, strategy, or markets.")
      setTimeout(() => setTopicError(''), 4000)
      return
    }
    setTopicError('')

    if (!subscribed) {
      const newCount = usage.count + 1
      setUsage(newCount)
      setUsageState({ count: newCount, weekStart: getWeekStart() })
    }

    const userMsg = { role: 'user', content: trimmed }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setIsTyping(true)

    try {
      const ctx = buildTradingContext(account, trades, positions)
      const apiResp = await callAI(updated, ctx)
      if (apiResp) {
        setMessages(prev => [...prev, { role: 'assistant', content: apiResp }])
      } else {
        await new Promise(r => setTimeout(r, 500 + Math.random() * 500))
        setMessages(prev => [...prev, { role: 'assistant', content: generateLocalResponse(trimmed, account, trades, positions) }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: generateLocalResponse(trimmed, account, trades, positions) }])
    } finally {
      setIsTyping(false)
    }
  }, [limitReached, subscribed, usage, messages, account, trades, positions])

  const handleSend = () => sendMessage(input)
  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }
  const clearChat = () => { setMessages([]); setInput('') }

  // ── Shared input box ─────────────────────────────────────────────────────────
  const renderInputBox = (disabled) => (
    <div className={`ai-input-box ${disabled ? 'disabled' : ''}`}>
      <textarea
        ref={inputRef}
        className="ai-textarea"
        placeholder="Ask about your trades, risk, or performance..."
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        rows={1}
        disabled={disabled}
      />
      <div className="ai-input-footer">
        <div className="ai-input-pills">
          <button className="ai-pill-btn">Default <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg></button>
          <button className="ai-pill-btn ai-pill-ideas">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            Ideas
          </button>
        </div>
        <button className="ai-send-btn" onClick={handleSend} disabled={!input.trim() || disabled}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
          </svg>
        </button>
      </div>
    </div>
  )

  // ── Shared messages view ─────────────────────────────────────────────────────
  const renderMessages = () => (
    <div className="ai-chat-layout">
      <div className="ai-messages">
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ai-msg-${m.role}`}>
            <div className="ai-msg-bubble">{renderMessage(m.content)}</div>
          </div>
        ))}
        {isTyping && (
          <div className="ai-msg ai-msg-assistant">
            <div className="ai-msg-bubble ai-typing"><span/><span/><span/></div>
          </div>
        )}
        <div ref={messagesEndRef}/>
      </div>
    </div>
  )

  // ── Toolbar ──────────────────────────────────────────────────────────────────
  const renderToolbar = (showUsage) => (
    <div className="ai-toolbar">
      <button className="ai-tool-btn" title="New chat" onClick={clearChat}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button className="ai-tool-btn" title="Chat history">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      </button>
      {showUsage && (
        <div className="ai-usage-pill">{remaining} / {MAX_FREE} free prompts this week</div>
      )}
    </div>
  )

  // ── Unsubscribed view ────────────────────────────────────────────────────────
  if (!subscribed) {
    const hasMessages = messages.length > 0
    return (
      <div className="ai-page">
        {renderToolbar(true)}

        {!hasMessages ? (
          <div className="ai-upsell">
            <div className="ai-logo-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h2 className="ai-upsell-title">Trade Smarter With Your AI Trading Assistant</h2>
            <p className="ai-upsell-sub">
              Get real-time trade analysis, personalized risk insights, and performance feedback — powered by AI and your live trading data.
            </p>
            <div className="ai-free-note">
              You have <strong>{remaining}</strong> free prompt{remaining !== 1 ? 's' : ''} remaining this week. Try it below or unlock unlimited access.
            </div>
            <button className="ai-unlock-btn" onClick={() => setSubscribed(true)}>
              Unlock AI Assistant for $25/year
            </button>
            <div className="ai-features-grid">
              {FEATURES.map((f, i) => (
                <div key={i} className="ai-feature-card">
                  <div className="ai-feature-icon">{f.icon}</div>
                  <div className="ai-feature-title">{f.title}</div>
                  <div className="ai-feature-desc">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        ) : renderMessages()}

        <div className={`ai-input-wrap ${hasMessages ? 'ai-input-bottom' : 'ai-input-center'}`}>
          {topicError && <div className="ai-topic-error">{topicError}</div>}
          {limitReached && (
            <div className="ai-limit-banner">
              You have used all {MAX_FREE} free prompts this week.
              <button className="ai-limit-upgrade" onClick={() => setSubscribed(true)}>Upgrade to unlimited →</button>
            </div>
          )}
          {renderInputBox(limitReached)}
        </div>
      </div>
    )
  }

  // ── Subscribed view ─────────────────────────────────────────────────────────
  const hasMessages = messages.length > 0

  return (
    <div className="ai-page">
      {renderToolbar(false)}

      {!hasMessages ? (
        <div className="ai-empty-state">
          <div className="ai-logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 className="ai-greeting">Hi, {firstName}!</h2>
          <p className="ai-greeting-sub">Your AI trading assistant is ready. Ask about trades, risk, or strategy.</p>

          <div className="ai-input-box ai-input-empty">
            {topicError && <div className="ai-topic-error ai-topic-error-inline">{topicError}</div>}
            {renderInputBox(false)}
          </div>

          <div className="ai-suggested">
            <div className="ai-suggested-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              </svg>
              Suggested
            </div>
            <div className="ai-suggested-chips">
              {SUGGESTED.map((s, i) => (
                <button key={i} className="ai-chip" onClick={() => sendMessage(s)}>{s}</button>
              ))}
            </div>
          </div>
          <div className="ai-disclaimer">AI insights are informational and do not constitute financial advice.</div>
        </div>
      ) : renderMessages()}

      {hasMessages && (
        <div className="ai-input-wrap ai-input-bottom">
          {topicError && <div className="ai-topic-error">{topicError}</div>}
          {renderInputBox(false)}
          <div className="ai-disclaimer ai-disclaimer-chat">AI insights are informational and do not constitute financial advice.</div>
        </div>
      )}
    </div>
  )
}
