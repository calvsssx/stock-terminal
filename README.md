# 📈 Market Terminal

A personal stock & crypto analysis platform with live data, interactive charts, technical indicators, and AI-powered analysis.

![Next.js](https://img.shields.io/badge/Next.js-14-black) ![Recharts](https://img.shields.io/badge/Recharts-2.12-blue) ![Claude AI](https://img.shields.io/badge/Claude-AI-orange)

## Features

- **Live Watchlist** — Track any stock or crypto ticker (AAPL, BTC-USD, etc.)
- **Interactive Charts** — Price, volume, RSI with 1D to 5Y timeframes
- **Technical Overlays** — SMA 20/50, Bollinger Bands, RSI(14)
- **Fundamentals** — P/E, EPS, market cap, beta, 52-week range, and more
- **AI Analysis** — Claude-powered bull/bear signals with confidence scores
- **Auto-Refresh** — Data updates every 60 seconds
- **Mobile Responsive** — Works on all screen sizes

## Quick Deploy to Vercel

### Step 1: Push to GitHub

```bash
cd stock-terminal
git init
git add .
git commit -m "Initial commit - Market Terminal"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/stock-terminal.git
git push -u origin main
```

### Step 2: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New Project"**
3. Import your `stock-terminal` repository
4. Vercel auto-detects Next.js — no config needed
5. Add environment variable:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your API key from [console.anthropic.com](https://console.anthropic.com)
6. Click **Deploy**

That's it! Your terminal will be live at `https://stock-terminal-xxx.vercel.app`

### Step 3 (Optional): Custom Domain

In Vercel dashboard → Settings → Domains → Add your custom domain.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | For AI analysis | Get from [console.anthropic.com](https://console.anthropic.com) |

> The app works without the API key — charts and metrics are fully functional. AI analysis will show a basic fallback instead of Claude-powered insights.

## Local Development

```bash
# Install dependencies
npm install

# Create .env.local with your API key
cp .env.example .env.local

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
stock-terminal/
├── app/
│   ├── api/
│   │   ├── quote/route.js      # Yahoo Finance quote proxy
│   │   ├── chart/route.js      # Yahoo Finance chart proxy
│   │   └── analyze/route.js    # Claude AI analysis (server-side)
│   ├── globals.css
│   ├── layout.js
│   └── page.js
├── components/
│   └── Terminal.js              # Main terminal UI
├── lib/
│   └── utils.js                 # Shared utilities & technicals
├── package.json
├── next.config.js
└── README.md
```

## API Architecture

The app uses Next.js API routes as a server-side proxy:

- **`/api/quote`** — Proxies Yahoo Finance quotes (avoids CORS)
- **`/api/chart`** — Proxies Yahoo Finance chart data
- **`/api/analyze`** — Calls Anthropic API server-side (keeps your API key safe)

## Adding Tickers

Click the **+** button in the watchlist to add any ticker:
- Stocks: `AAPL`, `AMZN`, `TSLA`, `NVDA`
- Crypto: `BTC-USD`, `ETH-USD`, `SOL-USD`, `DOGE-USD`
- ETFs: `SPY`, `QQQ`, `VOO`
- International: `TSM`, `BABA`, `NVO`

## Tech Stack

- **Next.js 14** — React framework with API routes
- **Recharts** — Chart library
- **Anthropic Claude** — AI-powered analysis
- **Yahoo Finance** — Market data (via server proxy)
- **Tailwind CSS** — Base styling

## License

MIT — use it however you want.
