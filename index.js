/**
 * Alpha Meme AI Agent - Railway Deploy
 * Wallet: 0x9C67140AdE64577ef6B40BeA6a801aDf1555a5E8
 * 
 * API Bankr: https://api.bankr.bot
 * API Clanker (via Bitquery): https://streaming.bitquery.io/graphql
 */

const http = require('http');
const url = require('url');

// Config
const CONFIG = {
  WALLET: '0x9C67140AdE64577ef6B40BeA6a801aDf1555a5E8',
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  BANKR_API_KEY: process.env.BANKR_API_KEY,
  BITQUERY_API_KEY: process.env.BITQUERY_API_KEY,
};

// Storage
const positions = new Map();

// ==========================================
// BANKR API - Trading Execution
// ==========================================

/**
 * Execute trade via Bankr Agent API
 * POST https://api.bankr.bot/agent/prompt
 */
async function bankrTrade(token, action, amount = '0.01') {
  const res = await fetch('https://api.bankr.bot/agent/prompt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': CONFIG.BANKR_API_KEY,
    },
    body: JSON.stringify({
      prompt: `${action} ${amount} ETH of ${token} on Base with 2% slippage`,
    }),
  });
  
  if (!res.ok) throw new Error(`Bankr API error: ${res.status}`);
  return res.json();
}

/**
 * Check job status
 * GET https://api.bankr.bot/agent/job/{jobId}
 */
async function checkBankrJob(jobId) {
  const res = await fetch(`https://api.bankr.bot/agent/job/${jobId}`, {
    headers: {
      'X-API-Key': CONFIG.BANKR_API_KEY,
    },
  });
  return res.json();
}

// ==========================================
// CLANKER API - Via Bitquery (GraphQL)
// ==========================================

/**
 * Scan Clanker tokens via Bitquery
 * Query Clanker deployer contract: 0x375C15db32D28cEcdcAB5C03Ab889bf15cbD2c5E
 */
async function scanClankerTokens() {
  const query = {
    query: `
      query {
        EVM(network: base) {
          Events(
            where: {
              Log: { Signature: { Name: { is: "TokenCreated" } } }
              LogHeader: { Address: { is: "0x375C15db32D28cEcdcAB5C03Ab889bf15cbD2c5E" } }
            }
            limit: 10
            orderBy: { descending: Block_Time }
          ) {
            Arguments {
              Name
              Value {
                ... on EVM_ABI_Address_Value_Arg { address }
                ... on EVM_ABI_String_Value_Arg { string }
                ... on EVM_ABI_BigInt_Value_Arg { bigInteger }
              }
            }
            Block { Time }
            Transaction { From }
          }
        }
      }
    `
  };

  const res = await fetch('https://streaming.bitquery.io/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': CONFIG.BITQUERY_API_KEY,
    },
    body: JSON.stringify(query),
  });

  const data = await res.json();
  const events = data.data?.EVM?.Events || [];
  
  return events.map(e => ({
    address: e.Arguments.find(a => a.Name === 'tokenAddress')?.Value?.address,
    name: e.Arguments.find(a => a.Name === 'name')?.Value?.string,
    symbol: e.Arguments.find(a => a.Name === 'symbol')?.Value?.string,
    supply: e.Arguments.find(a => a.Name === 'maxSupply')?.Value?.bigInteger,
    deployer: e.Transaction.From,
    createdAt: e.Block.Time,
  })).filter(t => t.address);
}

/**
 * Get token liquidity & volume (Bitquery)
 */
async function getTokenMetrics(tokenAddress) {
  const query = {
    query: `
      query {
        EVM(network: base) {
          DEXTrades(
            where: {
              Trade: { Currency: { SmartContract: { is: "${tokenAddress}" } } }
              Block: { Time: { since: "24 hours ago" } }
            }
          ) {
            Trade {
              AmountInUSD
              Side { Type }
            }
          }
        }
      }
    `
  };

  const res = await fetch('https://streaming.bitquery.io/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': CONFIG.BITQUERY_API_KEY,
    },
    body: JSON.stringify(query),
  });

  const data = await res.json();
  const trades = data.data?.EVM?.DEXTrades || [];
  
  const volume = trades.reduce((sum, t) => sum + parseFloat(t.Trade.AmountInUSD || 0), 0);
  const buys = trades.filter(t => t.Trade.Side?.Type === 'Buy').length;
  const sells = trades.filter(t => t.Trade.Side?.Type === 'Sell').length;
  
  return {
    volume24h: volume,
    buyPressure: buys / (buys + sells) || 0.5,
    tradeCount: trades.length,
  };
}

// ==========================================
// SMART MONEY ANALYSIS
// ==========================================

async function analyzeSmartMoney(tokenAddress) {
  const query = {
    query: `
      query {
        EVM(network: base) {
          DEXTrades(
            where: {
              Trade: { 
                Currency: { SmartContract: { is: "${tokenAddress}" } }
                AmountInUSD: { gt: "1000" }
              }
              Block: { Time: { since: "6 hours ago" } }
            }
            orderBy: { descending: Block_Time }
            limit: 50
          ) {
            Trade {
              Buyer
              Seller
              AmountInUSD
              Side { Type }
            }
          }
        }
      }
    `
  };

  const res = await fetch('https://streaming.bitquery.io/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': CONFIG.BITQUERY_API_KEY,
    },
    body: JSON.stringify(query),
  });

  const data = await res.json();
  const trades = data.data?.EVM?.DEXTrades || [];
  
  // Analyze whale activity
  const whaleBuys = trades.filter(t => t.Trade.Side?.Type === 'Buy' && parseFloat(t.Trade.AmountInUSD) > 5000);
  const whaleSells = trades.filter(t => t.Trade.Side?.Type === 'Sell' && parseFloat(t.Trade.AmountInUSD) > 5000);
  
  const buyVolume = whaleBuys.reduce((sum, t) => sum + parseFloat(t.Trade.AmountInUSD), 0);
  const sellVolume = whaleSells.reduce((sum, t) => sum + parseFloat(t.Trade.AmountInUSD), 0);
  
  const netFlow = buyVolume - sellVolume;
  const score = Math.min(Math.max((netFlow / 10000) + 0.5, 0), 1); // 0-1 scale
  
  return {
    score,
    whaleBuys: whaleBuys.length,
    whaleSells: whaleSells.length,
    netFlow,
    activity: trades.length,
  };
}

// ==========================================
// TRADING ENGINE
// ==========================================

async function scanOpportunities() {
  const tokens = await scanClankerTokens();
  const opportunities = [];
  
  for (const token of tokens.slice(0, 5)) { // Analyze top 5
    try {
      const [metrics, smartMoney] = await Promise.all([
        getTokenMetrics(token.address),
        analyzeSmartMoney(token.address),
      ]);
      
      const age = Date.now() - new Date(token.createdAt).getTime();
      const ageScore = age < 3600000 ? 0.9 : age < 7200000 ? 0.7 : 0.4;
      const volumeScore = Math.min(metrics.volume24h / 50000, 1) * 0.3;
      const smartScore = smartMoney.score * 0.4;
      const momentumScore = metrics.buyPressure * 0.3;
      
      const confidence = (ageScore * 0.3) + volumeScore + smartScore + momentumScore;
      
      opportunities.push({
        ...token,
        metrics,
        smartMoney,
        confidence: Math.min(confidence, 1),
        age: Math.floor(age / 60000) + 'm',
      });
    } catch (e) {
      console.error(`Error analyzing ${token.symbol}:`, e.message);
    }
  }
  
  return opportunities.sort((a, b) => b.confidence - a.confidence);
}

// ==========================================
// HTTP SERVER
// ==========================================

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  await new Promise(resolve => req.on('end', resolve));
  const jsonBody = body ? JSON.parse(body) : {};

  // Health
  if (path === '/' || path === '/health') {
    return res.end(JSON.stringify({
      status: 'operational',
      agent: 'Alpha Meme',
      version: '1.0.0',
      wallet: CONFIG.WALLET,
      apis: {
        bankr: 'https://api.bankr.bot',
        clanker: 'https://streaming.bitquery.io/graphql (Bitquery)',
      },
      timestamp: new Date().toISOString(),
    }));
  }

  // Skill Manifest
  if (path === '/skill' || path === '/skill.md') {
    return res.end(JSON.stringify({
      name: 'Alpha Meme',
      description: 'AI agent for autonomous meme coin trading with smart money tracking via Bankr API and Clanker data via Bitquery',
      version: '1.0.0',
      wallet: CONFIG.WALLET,
      category: 'trading',
      tags: ['meme', 'trading', 'base', 'ai', 'smart-money', 'clanker', 'bankr'],
      skills: [
        {
          name: 'scan_opportunities',
          description: 'Scan Clanker tokens with smart money analysis',
          pricing: { amount: '0.001', currency: 'ETH' },
        },
        {
          name: 'execute_trade',
          description: 'Execute buy/sell via Bankr API',
          parameters: {
            token: { type: 'string', required: true },
            action: { type: 'string', enum: ['buy', 'sell'], required: true },
            amount: { type: 'string', default: '0.01' },
          },
          pricing: { amount: '0.005', currency: 'ETH' },
        },
        {
          name: 'analyze_token',
          description: 'Deep analysis of specific token',
          pricing: { amount: '0.002', currency: 'ETH' },
        },
      ],
      endpoints: {
        health: '/health',
        skill: '/skill',
        scan: '/scan',
        trade: '/trade',
        analyze: '/analyze',
        portfolio: '/portfolio',
      },
    }, null, 2));
  }

  // Scan opportunities
  if (path === '/scan') {
    try {
      const opportunities = await scanOpportunities();
      return res.end(JSON.stringify({
        count: opportunities.length,
        opportunities: opportunities.map(o => ({
          address: o.address,
          symbol: o.symbol,
          name: o.name,
          confidence: o.confidence.toFixed(2),
          smartScore: o.smartMoney.score.toFixed(2),
          volume24h: o.metrics.volume24h.toFixed(2),
          age: o.age,
        })),
      }));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // Execute trade via Bankr
  if (path === '/trade' && req.method === 'POST') {
    const { token, action, amount } = jsonBody;
    
    if (!token || !action) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Need token and action' }));
    }

    try {
      const result = await bankrTrade(token, action, amount);
      
      if (action === 'buy' && result.jobId) {
        positions.set(token, {
          token,
          action,
          amount: amount || '0.01',
          entry: Date.now(),
          jobId: result.jobId,
          status: 'pending',
        });
      }

      return res.end(JSON.stringify({
        success: true,
        jobId: result.jobId,
        status: result.status,
        message: `${action} ${amount || '0.01'} ETH of ${token}`,
        checkStatus: `/job/${result.jobId}`,
      }));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // Check job status
  if (path.startsWith('/job/')) {
    const jobId = path.split('/')[2];
    try {
      const status = await checkBankrJob(jobId);
      return res.end(JSON.stringify(status));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // Analyze specific token
  if (path === '/analyze' && req.method === 'POST') {
    const { token } = jsonBody;
    if (!token) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Need token address' }));
    }

    try {
      const [metrics, smartMoney] = await Promise.all([
        getTokenMetrics(token),
        analyzeSmartMoney(token),
      ]);

      return res.end(JSON.stringify({
        token,
        metrics,
        smartMoney,
        recommendation: smartMoney.score > 0.7 ? 'STRONG_BUY' : 
                       smartMoney.score > 0.5 ? 'BUY' : 'HOLD',
      }));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // Portfolio
  if (path === '/portfolio') {
    return res.end(JSON.stringify({
      wallet: CONFIG.WALLET,
      positions: Array.from(positions.values()),
      totalPositions: positions.size,
    }));
  }

  // Auto-trade (cron endpoint)
  if (path === '/auto') {
    try {
      const opportunities = await scanOpportunities();
      const highConfidence = opportunities.filter(o => o.confidence > 0.8).slice(0, 2);
      
      const results = [];
      for (const opp of highConfidence) {
        const result = await bankrTrade(opp.address, 'buy', '0.01');
        results.push({
          token: opp.symbol,
          address: opp.address,
          confidence: opp.confidence,
          jobId: result.jobId,
        });
      }

      return res.end(JSON.stringify({
        autoTraded: results.length,
        results,
        scanned: opportunities.length,
      }));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // 404
  res.writeHead(404);
  res.end(JSON.stringify({ 
    error: 'Not found',
    available: ['/health', '/skill', '/scan', '/trade', '/analyze', '/portfolio', '/auto', '/job/:id'],
  }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Alpha Meme Agent running on port ${PORT}`);
  console.log(`💰 Wallet: ${CONFIG.WALLET}`);
  console.log(`🔗 Bankr API: https://api.bankr.bot`);
  console.log(`📊 Clanker/Bitquery: https://streaming.bitquery.io/graphql`);
});
