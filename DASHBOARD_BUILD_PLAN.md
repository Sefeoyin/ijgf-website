# IJGF Dashboard Build Plan

## Phase 1: Profile Page Updates (CURRENT)
✅ Fix profile page to match Figma design:
- Email field read-only with note
- Password section with "Change Password" button
- Proper button positioning (Cancel + Save Changes)

## Phase 2: Dashboard Overview/Home
Components needed:
1. Stats cards (4 cards):
   - Active Challenges
   - Total PNL  
   - Win Rate
   - Current Equity
   - Days Active
   
2. Equity Chart widget
   - Line chart with time range selector (1H, 3H, 5H, 1D, 1W, 1M)
   - Current balance display
   
3. Markets widget (right side)
   - List of crypto pairs with prices and 24h change
   - "View All" button
   
4. Active Challenges widget
   - Progress bar
   - "Start New Challenge" button
   
5. History widget  
   - Recent trades table
   - "View All" button

## Phase 3: Markets Page (Trading Interface)
Components needed:
1. Market selector with price info
2. TradingView-style chart
3. Order entry panel (LONG/SHORT tabs)
4. Positions & Orders table
5. Risk indicators

## Phase 4: Analytics Page
Components needed:
1. Performance stats cards
2. Equity curve chart
3. Daily P/L chart
4. Win/Loss distribution
5. Filters

## Phase 5: Trade History Page
Components needed:
1. Trade history table with:
   - Search and filter
   - Export to CSV
   - Pagination
   - Sortable columns

## Phase 6: Rules & Objectives Page
Components needed:
1. Challenge info card
2. Progress metrics
3. Rules accordions

## Phase 7: AI Assistant Page
Components needed:
1. Unsubscribed view (paywall)
2. Subscribed view (chat interface)

## APIs Needed:
- Binance API for market data
- Binance WebSocket for real-time prices
- Chart library (TradingView Lightweight Charts or Recharts)

## File Structure:
```
src/
├── pages/
│   ├── Dashboard/
│   │   ├── DashboardOverview.jsx
│   │   ├── MarketsPage.jsx
│   │   ├── AnalyticsPage.jsx
│   │   ├── TradeHistoryPage.jsx
│   │   ├── RulesPage.jsx
│   │   └── AIAssistantPage.jsx
├── components/
│   ├── dashboard/
│   │   ├── StatsCard.jsx
│   │   ├── EquityChart.jsx
│   │   ├── MarketsWidget.jsx
│   │   ├── TradesTable.jsx
│   │   ├── OrderEntry.jsx
│   │   └── RiskIndicators.jsx
```

## Current Step:
Fixing ProfilePage to match Figma
