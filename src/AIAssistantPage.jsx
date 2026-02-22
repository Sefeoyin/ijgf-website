import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Weekly usage tracking ───────────────────────────────────────────────────
const STORAGE_KEY = 'ijgf_ai_usage'
const MAX_FREE     = 5

function getUsage() {
  try {
    const raw  = localStorage.getItem(STORAGE_KEY)
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
  'why did i','how can i','help me'
]

function isCryptoRelated(text) {
  const lower = text.toLowerCase()
  return CRYPTO_KEYWORDS.some(kw => lower.includes(kw))
}

// ─── AI response engine (context-aware mock) ─────────────────────────────────
const AI_RESPONSES = {
  'analyze my last trade': (trades) => {
    if (!trades?.length) return "I don't see any recent closed trades in your account yet. Place some trades and I'll analyze your entries, exits, and risk management."
    const last = trades[trades.length - 1]
    const pnl  = last?.realized_pnl ?? 0
    const side = last?.side === 'buy' ? 'long' : 'short'
    const sym  = last?.symbol || 'BTC/USDT'
    const pct  = last?.pnl_percentage ? `${last.pnl_percentage > 0 ? '+' : ''}${last.pnl_percentage.toFixed(2)}%` : `${pnl > 0 ? '+' : ''}$${Math.abs(pnl).toFixed(2)}`
    if (pnl > 0) return `Your last ${sym} ${side} closed with a ${pct} gain. Entry timing aligned with the prevailing trend — solid execution. One area to review: compare your stop-loss distance against your average risk per trade. If you risked more than usual, consider tightening stops by 10–15% on similar setups to improve your risk-reward ratio.`
    if (pnl < 0) return `Your last ${sym} ${side} closed at ${pct}. The loss itself isn't the concern — how it was managed is. Check whether price hit your planned stop or if the position was closed manually. Emotional exits often cost more than the plan allows. Stick to pre-defined stops on your next setup.`
    return `Your last ${sym} trade broke even. This can indicate hesitation at entry or a stop-loss placed too tight. Review whether the original thesis played out — if it did but you exited early, that's a discipline issue worth addressing.`
  },
  'review my risk management': (trades) => {
    if (!trades?.length) return "No trade history found yet. Once you've placed some trades I'll review your position sizing, drawdown patterns, and risk-per-trade consistency."
    const losses = trades.filter(t => (t.realized_pnl || 0) < 0)
    const wins   = trades.filter(t => (t.realized_pnl || 0) > 0)
    const wr     = trades.length ? ((wins.length / trades.length) * 100).toFixed(0) : 0
    return `Based on your ${trades.length} closed trades: ${wr}% win rate, ${wins.length} wins vs ${losses.length} losses. ${
      wr >= 55
        ? 'Your win rate is above average. Focus on ensuring your average win is larger than your average loss — this is where the real edge compounds.'
        : wr >= 45
        ? 'Win rate is near neutral, which is fine if your average win exceeds your average loss. Review your R:R ratio — you want at least 1.5:1 to be net positive at this win rate.'
        : 'Win rate is below 50%. This isn\'t fatal — many profitable traders win less than half their trades. What matters is that your winners are significantly larger than your losers. If they\'re not, tighten entry criteria and cut losses faster.'
    }`
  },
  'why did i lose money today': (trades) => {
    const today  = new Date().toDateString()
    const todayT = (trades || []).filter(t => new Date(t.executed_at).toDateString() === today)
    const todayL = todayT.reduce((s, t) => s + (t.realized_pnl || 0), 0)
    if (todayL >= 0 || !todayT.length) return "I don't see a net loss today — or no trades have been placed yet. If you have open positions that are unrealized losses, those will reflect once closed."
    return `Today's net PnL: $${todayL.toFixed(2)}. You had ${todayT.length} trade(s). Common causes to review: (1) Trading against the higher-timeframe trend, (2) Overleveraging relative to your normal size, (3) Entering news-driven volatility without a clear edge, (4) Multiple trades in the same direction compounding one bad thesis. Pick the one that resonates — that's your lesson for today.`
  },
  'default': [
    "Crypto markets are driven by liquidity flows, sentiment, and macro catalysts. When analyzing a setup, always ask: where is the liquidity sitting above and below current price? That's where smart money is targeting.",
    "Drawdown management is the most underrated skill in prop trading. Your challenge has a 4% daily limit — treat 2% as your personal soft limit. Stopping at half your max drawdown preserves your ability to recover the same day.",
    "The best setups often look uncomfortable at entry. If everyone can see the trade clearly, most of the move has already happened. Look for asymmetric risk-reward where your downside is defined and your upside is 2–3x larger.",
    "Consistency beats performance in prop trading. A trader who makes 1% per week for 10 weeks is far more fundable than one who made 8% in week 1 and then gave half back. Prove process, not luck.",
    "When reviewing losing trades, separate 'bad process' losses from 'right process, bad outcome' losses. The market can punish good decisions in the short run. Only bad process losses require you to change behavior.",
    "Funding rate in perpetual futures is a real cost that compounds. If you're holding positions overnight in a high-funding environment, factor that into your expected P&L. Many traders lose money purely to funding drift.",
  ]
}

function generateResponse(message, trades) {
  const lower = message.toLowerCase()

  if (lower.includes('analyze') && (lower.includes('last trade') || lower.includes('recent trade'))) {
    return AI_RESPONSES['analyze my last trade'](trades)
  }
  if (lower.includes('risk management') || lower.includes('review my risk')) {
    return AI_RESPONSES['review my risk management'](trades)
  }
  if (lower.includes('lose money') || lower.includes('lost money') || lower.includes('why did i')) {
    return AI_RESPONSES['why did i lose money today'](trades)
  }
  if (lower.includes('win rate') || lower.includes('improve my win')) {
    return "Win rate improvement starts with trade selection, not trade management. Before entering, score each setup: Does it have a clear catalyst? Is the risk-reward at least 1.5:1? Is it in the direction of the higher timeframe trend? Only take setups that pass all three. Reducing trade frequency often raises win rate faster than any other change."
  }
  if (lower.includes('setup') || lower.includes('best setup') || lower.includes('what setup')) {
    return "Your highest-probability setups on crypto perpetuals are typically: (1) Trend continuation pullbacks to the 21 EMA on the 4H chart, (2) Range breakouts with volume confirmation, (3) Liquidity sweeps followed by strong rejection. Avoid counter-trend trades unless you have a very clear structure break on the higher timeframe."
  }
  if (lower.includes('drawdown') || lower.includes('draw down')) {
    return "Your challenge has a 6% max overall drawdown and a 4% daily limit. To protect these: never risk more than 0.5–1% per trade, stop trading for the day after 2 consecutive losses, and never try to recover a loss in the same session. Recovery mode leads to the worst drawdown violations."
  }
  if (lower.includes('leverage')) {
    return "Leverage amplifies both wins and losses, but it also amplifies your funding costs and liquidation risk. For challenge trading, I recommend using 3–5x maximum — enough to make meaningful gains on your profit target without risking a liquidation event that ends your challenge in one trade. Size the position, not the leverage."
  }
  if (lower.includes('btc') || lower.includes('bitcoin')) {
    return "Bitcoin remains the dominant market structure signal for all crypto. When BTC is in a clear trend, altcoins follow with amplified moves — 2–3x BTC's % move on the way up, and often more severe on the way down. Always check BTC's hourly structure before entering altcoin positions. Trading BTC against its trend is where most traders give back profits."
  }
  if (lower.includes('eth') || lower.includes('ethereum')) {
    return "ETH/USDT perp is the second most liquid market available to you. ETH tends to lead altcoin sentiment and often breaks structure before alts follow. Key levels to watch are round numbers ($100 increments) and previous monthly highs/lows — these attract significant liquidity and often act as precise reversal or continuation points."
  }
  if (lower.includes('stop loss') || lower.includes('take profit')) {
    return "Your challenge requires both stop-loss and take-profit on every trade — use this as a discipline tool, not a constraint. Set your SL at a level that invalidates your thesis (structure break, not just a $ amount). Set your TP at the next obvious liquidity level. Let the trade do the work. The biggest mistake is moving SL wider after entry to 'give it room' — this is how small losses become large ones."
  }
  if (lower.includes('strategy') || lower.includes('recommend')) {
    return "For challenge accounts, the optimal strategy is: 1–3 high-conviction trades per day maximum. Focus on the first 2 hours after major market open (US open at 14:30 WAT tends to bring volatility). Use the 15m chart for entry with the 4H chart for direction. Take profit at 1.5–2R and move on. Overtrading is the #1 reason traders fail challenges — discipline beats frequency."
  }
  // random default
  const defaults = AI_RESPONSES['default']
  return defaults[Math.floor(Math.random() * defaults.length)]
}

// ─── Feature cards (upsell) ───────────────────────────────────────────────────
const FEATURES = [
  {
    title: 'Trade Analysis',
    desc: 'Break down individual trades to understand entries, exits, and missed opportunities.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    title: 'Risk Suggestions',
    desc: 'Identify overexposure, drawdown risks, and position sizing issues before they become costly.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  {
    title: 'Performance Insights',
    desc: "Spot patterns across your trading history — what's working and what's holding you back.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    title: 'Strategy Recommendations',
    desc: 'Receive data-backed suggestions to improve consistency and execution.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
  },
]

const SUGGESTED = [
  'Analyze my last trade',
  'Review my risk management',
  'Why did I lose money today?',
  'What setups perform best for me?',
  'How can I improve my win rate?',
]

// ─── Main component ────────────────────────────────────────────────────────────
export default function AIAssistantPage({ userName, subscribed: initialSubscribed, trades = [] }) {
  const [subscribed,  setSubscribed]  = useState(initialSubscribed ?? false)
  const [messages,    setMessages]    = useState([])
  const [input,       setInput]       = useState('')
  const [isTyping,    setIsTyping]    = useState(false)
  const [usage,       setUsageState]  = useState(() => getUsage())
  const [topicError,  setTopicError]  = useState('')
  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)

  const firstName = (userName || 'Trader').split(' ')[0]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const remaining = MAX_FREE - (subscribed ? 0 : usage.count)
  const limitReached = !subscribed && usage.count >= MAX_FREE

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    if (limitReached) return

    // Topic guard
    if (!isCryptoRelated(trimmed)) {
      setTopicError("I'm focused on cryptocurrency trading topics only. Ask me about your trades, risk management, strategy, or market analysis.")
      setTimeout(() => setTopicError(''), 4000)
      return
    }

    setTopicError('')

    // Increment usage for free users
    if (!subscribed) {
      const newCount = usage.count + 1
      setUsage(newCount)
      setUsageState({ count: newCount, weekStart: getWeekStart() })
    }

    const userMsg = { role: 'user', content: trimmed }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    // Simulate network delay (realistic typing feel)
    const delay = 800 + Math.random() * 800
    await new Promise(r => setTimeout(r, delay))

    const response = generateResponse(trimmed, trades)
    setMessages(prev => [...prev, { role: 'assistant', content: response }])
    setIsTyping(false)
  }, [limitReached, subscribed, usage, trades])

  const handleSend = () => sendMessage(input)
  const handleKey  = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const clearChat = () => { setMessages([]); setInput('') }

  // ── Unsubscribed upsell view ────────────────────────────────────────────────
  if (!subscribed) {
    const hasMessages = messages.length > 0
    return (
      <div className="ai-page">
        {/* toolbar */}
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
          <div className="ai-usage-pill">
            {remaining} / {MAX_FREE} free prompts this week
          </div>
        </div>

        {!hasMessages ? (
          /* upsell landing */
          <div className="ai-upsell">
            <div className="ai-logo-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h2 className="ai-upsell-title">Trade Smarter With Your AI Trading Assistant</h2>
            <p className="ai-upsell-sub">
              Get real-time trade analysis, personalized risk insights, and performance feedback
              — designed to help you trade with discipline and confidence.
            </p>

            <div className="ai-free-note">
              You have <strong>{remaining}</strong> free prompt{remaining !== 1 ? 's' : ''} remaining this week.
              Try it below or unlock unlimited access.
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
        ) : (
          /* free user chat view */
          <div className="ai-chat-layout">
            <div className="ai-messages">
              {messages.map((m, i) => (
                <div key={i} className={`ai-msg ai-msg-${m.role}`}>
                  <div className="ai-msg-bubble">{m.content}</div>
                </div>
              ))}
              {isTyping && (
                <div className="ai-msg ai-msg-assistant">
                  <div className="ai-msg-bubble ai-typing">
                    <span/><span/><span/>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef}/>
            </div>
          </div>
        )}

        {/* input bar — always visible for free users */}
        <div className={`ai-input-wrap ${hasMessages ? 'ai-input-bottom' : 'ai-input-center'}`}>
          {topicError && <div className="ai-topic-error">{topicError}</div>}
          {limitReached && (
            <div className="ai-limit-banner">
              You've used all {MAX_FREE} free prompts this week.
              <button className="ai-limit-upgrade" onClick={() => setSubscribed(true)}>
                Upgrade to unlimited →
              </button>
            </div>
          )}
          <div className={`ai-input-box ${limitReached ? 'disabled' : ''}`}>
            <textarea
              ref={inputRef}
              className="ai-textarea"
              placeholder="Ask about your trades, risk, or performance..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
              disabled={limitReached}
            />
            <div className="ai-input-footer">
              <div className="ai-input-pills">
                <button className="ai-pill-btn">Default <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg></button>
                <button className="ai-pill-btn ai-pill-ideas">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                  Ideas
                </button>
              </div>
              <button
                className="ai-send-btn"
                onClick={handleSend}
                disabled={!input.trim() || limitReached}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Subscribed view ─────────────────────────────────────────────────────────
  const hasMessages = messages.length > 0

  return (
    <div className="ai-page">
      {/* toolbar */}
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
      </div>

      {!hasMessages ? (
        /* empty state */
        <div className="ai-empty-state">
          <div className="ai-logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 className="ai-greeting">Hi, {firstName}!</h2>
          <p className="ai-greeting-sub">Welcome back to your AI trading assistant.</p>

          <div className="ai-input-box ai-input-empty">
            {topicError && <div className="ai-topic-error ai-topic-error-inline">{topicError}</div>}
            <textarea
              ref={inputRef}
              className="ai-textarea"
              placeholder="Ask about your trades, risk, or performance..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
            />
            <div className="ai-input-footer">
              <div className="ai-input-pills">
                <button className="ai-pill-btn">Default <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg></button>
                <button className="ai-pill-btn ai-pill-ideas">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                  Ideas
                </button>
              </div>
              <button
                className="ai-send-btn"
                onClick={handleSend}
                disabled={!input.trim()}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                </svg>
              </button>
            </div>
          </div>

          {/* suggested prompts */}
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

          <div className="ai-disclaimer">
            AI insights are informational and do not constitute financial advice.
          </div>
        </div>
      ) : (
        /* chat view */
        <div className="ai-chat-layout">
          <div className="ai-messages">
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ai-msg-${m.role}`}>
                <div className="ai-msg-bubble">{m.content}</div>
              </div>
            ))}
            {isTyping && (
              <div className="ai-msg ai-msg-assistant">
                <div className="ai-msg-bubble ai-typing">
                  <span/><span/><span/>
                </div>
              </div>
            )}
            <div ref={messagesEndRef}/>
          </div>
        </div>
      )}

      {/* input bar for chat view */}
      {hasMessages && (
        <div className="ai-input-wrap ai-input-bottom">
          {topicError && <div className="ai-topic-error">{topicError}</div>}
          <div className="ai-input-box">
            <textarea
              ref={inputRef}
              className="ai-textarea"
              placeholder="Ask about your trades, risk, or performance..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
            />
            <div className="ai-input-footer">
              <div className="ai-input-pills">
                <button className="ai-pill-btn">Default <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg></button>
                <button className="ai-pill-btn ai-pill-ideas">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                  Ideas
                </button>
              </div>
              <button
                className="ai-send-btn"
                onClick={handleSend}
                disabled={!input.trim()}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                </svg>
              </button>
            </div>
          </div>
          <div className="ai-disclaimer ai-disclaimer-chat">
            AI insights are informational and do not constitute financial advice.
          </div>
        </div>
      )}
    </div>
  )
}
