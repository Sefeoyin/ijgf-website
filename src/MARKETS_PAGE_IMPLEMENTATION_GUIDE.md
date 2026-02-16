# Markets Page - Implementation Guide

## ✅ PHASE 3A: UI COMPLETE

### What's Been Built:

1. **MarketsPage.jsx** - Full Binance-style trading interface with:
   - Market selector with live prices from CoinGecko
   - Real-time price stats (Last Price, 24h Change, High, Low, Volume)
   - Chart placeholder (ready for TradingView integration)
   - Complete order entry panel with:
     * Buy/Sell (Long/Short) tabs
     * Order types: Limit, Market, Stop-Limit
     * Leverage slider (1x-10x)
     * Amount shortcuts (25%, 50%, 75%, 100%)
   - Demo account balance display
   - Positions table with PNL tracking
   - Open orders table
   - Trade history table
   - Empty states for all tables

2. **Dashboard.jsx** - Updated to:
   - Import MarketsPage component
   - Enable Market tab in sidebar
   - Route to MarketsPage when clicked

3. **App.css** - Complete Binance-style CSS:
   - Professional trading interface styling
   - Responsive design for mobile/tablet
   - Hover effects and transitions
   - Color-coded buy/sell buttons
   - Table styling with alternating rows

---

## 🚀 NEXT: PHASE 3B - BINANCE API INTEGRATION

### Architecture Overview:

```
┌─────────────────────────────────────────────────────────────┐
│                    IJGF Platform                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Frontend (React)                                           │
│  ├── MarketsPage.jsx (UI)                                   │
│  ├── Demo Trading Logic                                     │
│  └── Real-time Price Updates                                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Backend (Supabase)                                         │
│  ├── Database Tables:                                       │
│  │   ├── demo_accounts                                      │
│  │   ├── demo_trades                                        │
│  │   ├── demo_positions                                     │
│  │   ├── demo_orders                                        │
│  │   ├── challenge_progress                                 │
│  │   └── challenge_violations                               │
│  │                                                          │
│  └── Edge Functions (API Routes):                           │
│      ├── /binance-proxy                                     │
│      ├── /execute-trade                                     │
│      ├── /check-rules                                       │
│      └── /get-positions                                     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Binance Testnet API                                        │
│  ├── Market Data (WebSocket)                                │
│  ├── Order Execution                                        │
│  ├── Position Management                                    │
│  └── Account Info                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 DATABASE SCHEMA NEEDED

### 1. demo_accounts
```sql
CREATE TABLE demo_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_type VARCHAR(50), -- '5k', '10k', '25k', '50k', '100k'
  initial_balance DECIMAL(12, 2) DEFAULT 10000.00,
  current_balance DECIMAL(12, 2) DEFAULT 10000.00,
  equity DECIMAL(12, 2) DEFAULT 10000.00,
  profit_target DECIMAL(12, 2), -- e.g., 10% of initial
  max_daily_loss DECIMAL(12, 2), -- e.g., 4% of initial
  max_total_drawdown DECIMAL(12, 2), -- e.g., 6% of initial
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'passed', 'failed'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, challenge_type)
);
```

### 2. demo_trades
```sql
CREATE TABLE demo_trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  demo_account_id UUID REFERENCES demo_accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL, -- 'BTCUSDT', 'ETHUSDT'
  side VARCHAR(10) NOT NULL, -- 'BUY', 'SELL'
  order_type VARCHAR(20) NOT NULL, -- 'MARKET', 'LIMIT', 'STOP_LIMIT'
  price DECIMAL(18, 8) NOT NULL,
  quantity DECIMAL(18, 8) NOT NULL,
  leverage INT DEFAULT 1,
  total DECIMAL(18, 8) NOT NULL,
  fee DECIMAL(18, 8) DEFAULT 0,
  pnl DECIMAL(18, 8), -- Profit/Loss when closed
  status VARCHAR(20) DEFAULT 'filled', -- 'filled', 'cancelled'
  executed_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  
  INDEX(user_id, executed_at),
  INDEX(demo_account_id, executed_at)
);
```

### 3. demo_positions
```sql
CREATE TABLE demo_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  demo_account_id UUID REFERENCES demo_accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL, -- 'LONG', 'SHORT'
  entry_price DECIMAL(18, 8) NOT NULL,
  quantity DECIMAL(18, 8) NOT NULL,
  leverage INT DEFAULT 1,
  margin DECIMAL(18, 8) NOT NULL,
  liquidation_price DECIMAL(18, 8),
  unrealized_pnl DECIMAL(18, 8) DEFAULT 0,
  realized_pnl DECIMAL(18, 8) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'open', -- 'open', 'closed'
  opened_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  
  UNIQUE(demo_account_id, symbol, status) WHERE status = 'open'
);
```

### 4. demo_orders
```sql
CREATE TABLE demo_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  demo_account_id UUID REFERENCES demo_accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL, -- 'BUY', 'SELL'
  order_type VARCHAR(20) NOT NULL, -- 'LIMIT', 'STOP_LIMIT'
  price DECIMAL(18, 8) NOT NULL,
  stop_price DECIMAL(18, 8), -- For stop-limit orders
  quantity DECIMAL(18, 8) NOT NULL,
  filled DECIMAL(18, 8) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'open', -- 'open', 'filled', 'cancelled'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(user_id, status),
  INDEX(demo_account_id, status)
);
```

### 5. challenge_progress
```sql
CREATE TABLE challenge_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  demo_account_id UUID REFERENCES demo_accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  starting_balance DECIMAL(12, 2),
  ending_balance DECIMAL(12, 2),
  daily_pnl DECIMAL(12, 2),
  total_pnl DECIMAL(12, 2),
  max_drawdown DECIMAL(12, 2),
  current_drawdown DECIMAL(12, 2),
  profit_target_reached BOOLEAN DEFAULT FALSE,
  daily_loss_limit_hit BOOLEAN DEFAULT FALSE,
  max_drawdown_hit BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(demo_account_id, date)
);
```

### 6. challenge_violations
```sql
CREATE TABLE challenge_violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  demo_account_id UUID REFERENCES demo_accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  violation_type VARCHAR(50) NOT NULL, -- 'DAILY_LOSS', 'MAX_DRAWDOWN', 'LEVERAGE_EXCEEDED'
  description TEXT,
  balance_at_violation DECIMAL(12, 2),
  violation_amount DECIMAL(12, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(user_id, created_at),
  INDEX(demo_account_id, violation_type)
);
```

---

## 🔧 SUPABASE EDGE FUNCTIONS NEEDED

### 1. Execute Trade Function
```javascript
// supabase/functions/execute-trade/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const { symbol, side, orderType, price, amount, leverage, userId } = await req.json()
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  )
  
  // 1. Get user's demo account
  const { data: account } = await supabase
    .from('demo_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()
    
  if (!account) {
    return new Response(JSON.stringify({ error: 'No active demo account' }), {
      status: 400
    })
  }
  
  // 2. Check if user has sufficient balance
  const total = price * amount
  if (total > account.current_balance) {
    return new Response(JSON.stringify({ error: 'Insufficient balance' }), {
      status: 400
    })
  }
  
  // 3. Execute trade on Binance Testnet
  const binanceResponse = await executeBinanceTrade({
    symbol,
    side,
    type: orderType,
    price,
    quantity: amount
  })
  
  // 4. Record trade in database
  const { data: trade } = await supabase
    .from('demo_trades')
    .insert({
      demo_account_id: account.id,
      user_id: userId,
      symbol,
      side,
      order_type: orderType,
      price,
      quantity: amount,
      leverage,
      total,
      fee: total * 0.001 // 0.1% fee
    })
    .select()
    .single()
  
  // 5. Update or create position
  await updatePosition(supabase, account.id, userId, {
    symbol,
    side,
    price,
    quantity: amount,
    leverage
  })
  
  // 6. Update account balance
  await supabase
    .from('demo_accounts')
    .update({
      current_balance: account.current_balance - total,
      updated_at: new Date().toISOString()
    })
    .eq('id', account.id)
  
  // 7. Check challenge rules
  await checkChallengeRules(supabase, account.id, userId)
  
  return new Response(JSON.stringify({ success: true, trade }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

### 2. Check Rules Function
```javascript
// Check daily loss, max drawdown, profit target
async function checkChallengeRules(supabase, accountId, userId) {
  const { data: account } = await supabase
    .from('demo_accounts')
    .select('*')
    .eq('id', accountId)
    .single()
    
  const currentDrawdown = account.initial_balance - account.current_balance
  
  // Check max drawdown
  if (currentDrawdown >= account.max_total_drawdown) {
    await supabase
      .from('challenge_violations')
      .insert({
        demo_account_id: accountId,
        user_id: userId,
        violation_type: 'MAX_DRAWDOWN',
        description: 'Maximum drawdown limit exceeded',
        balance_at_violation: account.current_balance,
        violation_amount: currentDrawdown
      })
    
    await supabase
      .from('demo_accounts')
      .update({ status: 'failed' })
      .eq('id', accountId)
      
    return { failed: true, reason: 'MAX_DRAWDOWN' }
  }
  
  // Check profit target
  const totalProfit = account.current_balance - account.initial_balance
  if (totalProfit >= account.profit_target) {
    await supabase
      .from('demo_accounts')
      .update({ status: 'passed' })
      .eq('id', accountId)
      
    return { passed: true }
  }
  
  return { status: 'active' }
}
```

---

## 🔌 BINANCE TESTNET INTEGRATION

### Setup:
1. Create account at: https://testnet.binance.vision/
2. Generate API keys
3. Store in Supabase secrets:
   - `BINANCE_TESTNET_API_KEY`
   - `BINANCE_TESTNET_SECRET_KEY`

### WebSocket for Real-time Prices:
```javascript
// In MarketsPage.jsx
useEffect(() => {
  const ws = new WebSocket('wss://testnet.binance.vision/ws/btcusdt@ticker')
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)
    setMarketPrice(parseFloat(data.c)) // Current price
    setPriceChange24h(parseFloat(data.P)) // 24h change %
    setHigh24h(parseFloat(data.h))
    setLow24h(parseFloat(data.l))
    setVolume24h(parseFloat(data.v))
  }
  
  return () => ws.close()
}, [selectedPair])
```

---

## 📈 TRADINGVIEW CHART INTEGRATION

### Install Library:
```bash
npm install lightweight-charts
```

### Implementation:
```javascript
import { createChart } from 'lightweight-charts'

useEffect(() => {
  const chart = createChart(chartContainerRef.current, {
    width: chartContainerRef.current.clientWidth,
    height: 500,
    layout: {
      background: { color: '#0A0E1A' },
      textColor: '#DDD',
    },
    grid: {
      vertLines: { color: '#1a1e2e' },
      horzLines: { color: '#1a1e2e' },
    },
  })

  const candlestickSeries = chart.addCandlestickSeries()
  
  // Fetch and display candlestick data
  fetch(`https://api.binance.com/api/v3/klines?symbol=${selectedPair}&interval=15m&limit=100`)
    .then(res => res.json())
    .then(data => {
      const candles = data.map(d => ({
        time: d[0] / 1000,
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4])
      }))
      candlestickSeries.setData(candles)
    })
    
  return () => chart.remove()
}, [selectedPair])
```

---

## 🎯 IMPLEMENTATION CHECKLIST

### Immediate (Can do now):
- [x] Markets page UI complete
- [x] Order entry panel functional
- [x] Demo data displaying in tables
- [ ] Add tab switching for Positions/Orders/History
- [ ] Integrate TradingView chart

### Backend Setup (Next):
- [ ] Create Supabase database tables
- [ ] Set up Binance Testnet account
- [ ] Create Supabase Edge Functions
- [ ] Connect WebSocket for real-time prices
- [ ] Implement order execution logic
- [ ] Add challenge rules checking

### Testing:
- [ ] Place demo trades
- [ ] Verify PNL calculations
- [ ] Test leverage calculations
- [ ] Test daily loss limits
- [ ] Test max drawdown limits
- [ ] Test profit target achievement

---

## 💡 NEXT STEPS

Would you like me to:

1. **Add tab switching** to show/hide Positions, Orders, and History tables?
2. **Integrate TradingView chart** right now?
3. **Create the Supabase database schema** SQL scripts?
4. **Build the Supabase Edge Functions** for trade execution?
5. **Set up Binance WebSocket** for real-time price updates?

Let me know what you'd like to tackle next! 🚀
