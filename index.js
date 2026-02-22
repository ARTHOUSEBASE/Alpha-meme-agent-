/**
 * Alpha Meme AI Agent
 * Autonomous Meme Coin Trading Agent
 * Wallet: 0x9C67140AdE64577ef6B40BeA6a801aDf1555a5E8
 */

const http = require('http');
const url = require('url');

// Config from environment variables
const CONFIG = {
  WALLET: '0x9C67140AdE64577ef6B40BeA6a801aDf1555a5E8',
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  BANKR_API_KEY: process.env.BANKR_API_KEY,
  BITQUERY_API_KEY: process.env.BITQUERY_API_KEY,
};

// In-memory storage (gunakan database untuk production)
const positions = new Map();
const scannedTokens = [];

// Scan meme tokens dari Clanker
async function scanTokens() {
  const query = {
    query: `{
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
            }
          }
          Block { Time }
          Transaction { From }
        }
      }
    }`
  };

  try {
    const res = await fetch('https://streaming.bitquery.io/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.BITQUERY_API_KEY,
      },
      body: JSON.stringify(query),
    });

    const data = await res.json();
    const events = data.data?.EVM?.Events || [];
    
    const tokens = events.map(e => ({
      address: e.Arguments.find(a => a.Name === 'tokenAddress')?.Value?.address,
      name: e.Arguments.find(a => a.Name === 'name')?.Value?.string,
      symbol: e.Arguments.find(a => a.Name === 'symbol')?.Value?.string,
      deployer: e.Transaction.From,
      created: e.Block.Time,
    })).filter(t => t.address);

    scannedTokens.push(...tokens);
    return tokens;
  } catch (e) {
    console.error('Scan error:', e);
    return [];
  }
}

// Execute trade via Bankr API
async function executeTrade(token, action, amount = '0.01') {
  const res = await fetch('https://api.bankr.bot/agent/prompt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.BANKR_API_KEY,
    },
    body: JSON.stringify({
      prompt: `${action} ${amount} ETH of ${token} on Base with 2% slippage`,
    }),
  });
  return res.json();
}

// Calculate smart money score (simplified)
function calculateScore(token) {
  // Mock scoring - ganti dengan real analysis
  const age = Date.now() - new Date(token.created).getTime();
  const ageScore = age < 3600000 ? 0.9 : age < 7200000 ? 0.7 : 0.5; // <1h = 0.9, <2h = 0.7
  
  return {
    confidence: ageScore,
    smartScore: 0.6,
    narrativeScore: ageScore,
  };
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  // CORS headers
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

  // Health check
  if (path === '/health' || path === '/') {
    return res.end(JSON.stringify({
      status: 'operational',
      agent: 'Alpha Meme',
      version: '1.0.0',
      wallet: CONFIG.WALLET,
      timestamp: new Date().toISOString(),
    }));
  }

  // Skill manifest untuk OpenAgent Market
  if (path === '/skill' || path === '/skill.md') {
    return res.end(JSON.stringify({
      name: 'Alpha Meme',
      description: 'AI agent for autonomous meme coin trading with smart money tracking, narrative momentum analysis, and copy-trading on Base blockchain',
      version: '1.0.0',
      wallet: CONFIG.WALLET,
      category: 'trading',
      tags: ['meme', 'trading', 'base', 'ai', 'smart-money', 'copy-trading'],
      skills: [
        {
          name: 'scan_opportunities',
          description: 'Scan for high-confidence meme coin opportunities',
          parameters: { minConfidence: { type: 'number', default: 0.7 } },
          pricing: { amount: '0.001', currency: 'ETH' }
        },
        {
          name: 'execute_trade',
          description: 'Execute buy or sell trade on Base',
          parameters: {
            token: { type: 'string', required: true },
            action: { type: 'string', enum: ['buy', 'sell'], required: true },
            amount: { type: 'string', default: '0.01' }
          },
          pricing: { amount: '0.005', currency: 'ETH' }
        },
        {
          name: 'get_portfolio',
          description: 'Get current portfolio and positions',
          parameters: {},
          pricing: { amount: '0', currency: 'ETH' }
        }
      ],
      endpoints: {
        health: '/health',
        skill: '/skill',
        scan: '/scan',
        trade: '/trade',
        portfolio: '/portfolio'
      }
    }, null, 2));
  }

  // Scan tokens
  if (path === '/scan') {
    const tokens = await scanTokens();
    const scored = tokens.map(t => ({
      ...t,
      ...calculateScore(t),
      age: Math.floor((Date.now() - new Date(t.created).getTime()) / 60000) + 'm ago'
    })).sort((a, b) => b.confidence - a.confidence);

    return res.end(JSON.stringify({
      count: scored.length,
      opportunities: scored.filter(t => t.confidence > 0.7),
      tokens: scored
    }));
  }

  // Execute trade
  if (path === '/trade' && req.method === 'POST') {
    const { token, action, amount } = jsonBody;
    
    if (!token || !action) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Missing token or action' }));
    }

    try {
      const result = await executeTrade(token, action, amount);
      
      if (action === 'buy' && result.jobId) {
        positions.set(token, {
          token,
          action,
          amount: amount || '0.01',
          entry: Date.now(),
          jobId: result.jobId,
          status: 'pending'
        });
      }

      return res.end(JSON.stringify({
        success: !!result.jobId,
        jobId: result.jobId,
        status: result.status,
        message: `${action} ${amount || '0.01'} ETH of ${token}`
      }));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // Get portfolio
  if (path === '/portfolio') {
    return res.end(JSON.stringify({
      wallet: CONFIG.WALLET,
      totalPositions: positions.size,
      positions: Array.from(positions.values()),
      scannedHistory: scannedTokens.length
    }));
  }

  // Auto-trading endpoint (cron job)
  if (path === '/auto') {
    const tokens = await scanTokens();
    const highConfidence = tokens
      .map(t => ({ ...t, ...calculateScore(t) }))
      .filter(t => t.confidence > 0.85)
      .slice(0, 2); // Max 2 trades

    const results = [];
    for (const token of highConfidence) {
      const result = await executeTrade(token.address, 'buy', '0.01');
      results.push({
        token: token.symbol,
        address: token.address,
        confidence: token.confidence,
        jobId: result.jobId
      });
    }

    return res.end(JSON.stringify({
      autoTraded: results.length,
      results,
      message: 'Auto-scan and trade completed'
    }));
  }

  // 404
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found', path }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Alpha Meme Agent running on port ${PORT}`);
  console.log(`💰 Wallet: ${CONFIG.WALLET}`);
});
