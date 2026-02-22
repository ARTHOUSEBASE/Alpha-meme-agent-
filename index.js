/**
 * Alpha Meme AI Agent - Railway Deploy
 * Environment: ALCHEMY + BANKR (No Bitquery)
 * Wallet: 0x9C67140AdE64577ef6B40BeA6a801aDf1555a5E8
 */

const http = require('http');
const url = require('url');

// ==========================================
// ENVIRONMENT CONFIGURATION
// ==========================================

const CONFIG = {
  // Wallet
  WALLET: '0x9C67140AdE64577ef6B40BeA6a801aDf1555a5E8',
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  
  // APIs
  ALCHEMY_KEY: process.env.ALCHEMY_KEY,           // From alchemy.com
  BANKR_API_KEY: process.env.BANKR_API_KEY,       // From bankr.bot
  
  // Trading Settings
  MAX_TRADE_SIZE: '0.01',  // ETH
  MIN_CONFIDENCE: 0.7,
  STOP_LOSS: 0.20,         // 20%
  TAKE_PROFIT: 0.50,       // 50%
};

// Alchemy Base Mainnet Endpoint
const ALCHEMY_URL = `https://base-mainnet.g.alchemy.com/v2/${CONFIG.ALCHEMY_KEY}`;

// Bankr API Endpoint
const BANKR_URL = 'https://api.bankr.bot';

// Storage
const positions = new Map();
const tradeHistory = [];

// ==========================================
// ALCHEMY API FUNCTIONS
// ==========================================

/**
 * Get latest block number
 */
async function getLatestBlock() {
  const res = await fetch(ALCHEMY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_blockNumber',
      params: [],
    }),
  });
  const data = await res.json();
  return parseInt(data.result, 16);
}

/**
 * Get token metadata
 */
async function getTokenMetadata(contractAddress) {
  const res = await fetch(`${ALCHEMY_URL}/getTokenMetadata?contractAddress=${contractAddress}`);
  return res.json();
}

/**
 * Get token balances for address
 */
async function getTokenBalances(address, contractAddresses = []) {
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'alchemy_getTokenBalances',
    params: [address, contractAddresses],
  };
  
  const res = await fetch(ALCHEMY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  const data = await res.json();
  return data.result?.tokenBalances || [];
}

/**
 * Get asset transfers (token transactions)
 */
async function getAssetTransfers(contractAddress, fromBlock, toBlock = 'latest') {
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'alchemy_getAssetTransfers',
    params: [{
      fromBlock: fromBlock || '0x' + (await getLatestBlock() - 1000).toString(16),
      toBlock,
      contractAddresses: [contractAddress],
      category: ['erc20'],
      withMetadata: true,
      maxCount: '0x64', // 100 results
      order: 'descending',
    }],
  };

  const res = await fetch(ALCHEMY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return data.result?.transfers || [];
}

/**
 * Get logs (events) from contract
 */
async function getLogs(address, topic, fromBlock, toBlock = 'latest') {
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_getLogs',
    params: [{
      address,
      fromBlock: fromBlock || '0x' + (await getLatestBlock() - 500).toString(16),
      toBlock,
      topics: topic ? [topic] : [],
    }],
  };

  const res = await fetch(ALCHEMY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return data.result || [];
}

// ==========================================
// CLANKER SCANNER (Using Alchemy)
// ==========================================

const CLANKER_FACTORY = '0x375C15db32D28cEcdcAB5C03Ab889bf15cbD2c5E';

/**
 * Scan new Clanker tokens
 */
async function scanClankerTokens() {
  const latestBlock = await getLatestBlock();
  const fromBlock = '0x' + (latestBlock - 2000).toString(16); // ~6 hours back
  
  // Get TokenCreated events from Clanker factory
  const logs = await getLogs(
    CLANKER_FACTORY,
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // Transfer event
    fromBlock
  );

  // Extract unique token addresses
  const tokenAddresses = [...new Set(logs.map(log => log.address))];
  
  // Get metadata for each token
  const tokens = await Promise.all(
    tokenAddresses.slice(0, 15).map(async (addr) => {
      try {
        const metadata = await getTokenMetadata(addr);
        const transfers = await getAssetTransfers(addr, fromBlock);
        
        // Calculate metrics
        const uniqueSenders = new Set(transfers.map(t => t.from)).size;
        const uniqueReceivers = new Set(transfers.map(t => t.to)).size;
        const totalVolume = transfers.reduce((sum, t) => {
          const value = parseInt(t.value, 16) / 1e18;
          return sum + value;
        }, 0);

        return {
          address: addr,
          name: metadata.name || 'Unknown',
          symbol: metadata.symbol || 'UNK',
          decimals: metadata.decimals || 18,
          logo: metadata.logo,
          totalSupply: metadata.totalSupply,
          transfers24h: transfers.length,
          uniqueTraders: uniqueSenders + uniqueReceivers,
          volume24h: totalVolume.toFixed(4),
          deployer: transfers[0]?.from || 'Unknown',
          createdAt: transfers[0]?.metadata?.blockTimestamp || Date.now(),
          rawTransfers: transfers.slice(0, 10), // Keep recent for analysis
        };
      } catch (e) {
        console.error(`Error fetching ${addr}:`, e.message);
        return null;
      }
    })
  );

  return tokens.filter(t => t !== null && t.symbol !== 'UNK');
}

// ==========================================
// SMART MONEY ANALYSIS
// ==========================================

/**
 * Analyze smart money patterns
 */
async function analyzeSmartMoney(tokenAddress) {
  const latestBlock = await getLatestBlock();
  const fromBlock = '0x' + (latestBlock - 4000).toString(16); // ~12 hours
  
  const transfers = await getAssetTransfers(tokenAddress, fromBlock);
  
  if (transfers.length === 0) {
    return { score: 0.3, activity: 'low', whales: 0 };
  }

  // Identify whale transactions (> 1000 tokens)
  const whales = transfers.filter(t => {
    const value = parseInt(t.value, 16) / 1e18;
    return value > 1000;
  });

  // Calculate buy/sell pressure
  const uniqueBuyers = new Set();
  const uniqueSellers = new Set();
  let buyVolume = 0;
  let sellVolume = 0;

  whales.forEach(t => {
    const value = parseInt(t.value, 16) / 1e18;
    
    // Simple heuristic: if to address is new, likely buy
    if (t.to && t.to !== tokenAddress) {
      uniqueBuyers.add(t.to);
      buyVolume += value;
    }
    if (t.from && t.from !== CLANKER_FACTORY) {
      uniqueSellers.add(t.from);
      sellVolume += value;
    }
  });

  // Calculate smart score
  const netFlow = buyVolume - sellVolume;
  const totalVolume = buyVolume + sellVolume;
  const flowRatio = totalVolume > 0 ? (netFlow / totalVolume + 1) / 2 : 0.5;
  const whaleActivity = Math.min(whales.length / 10, 1);
  
  const score = (flowRatio * 0.6) + (whaleActivity * 0.4);
  
  return {
    score: Math.min(Math.max(score, 0), 1),
    whales: whales.length,
    uniqueWhales: uniqueBuyers.size,
    netFlow: netFlow.toFixed(2),
    buyVolume: buyVolume.toFixed(2),
    sellVolume: sellVolume.toFixed(2),
    activity: transfers.length > 50 ? 'high' : transfers.length > 20 ? 'medium' : 'low',
    recentWhales: whales.slice(0, 5).map(w => ({
      from: w.from,
      to: w.to,
      value: (parseInt(w.value, 16) / 1e18).toFixed(2),
      hash: w.hash,
    })),
  };
}

// ==========================================
// SCORING ENGINE
// ==========================================

function calculateTokenScore(token, smartMoney) {
  const age = Date.now() - new Date(token.createdAt).getTime();
  const ageHours = age / 3600000;
  
  // Age scoring (newer = higher score, but not too new)
  let ageScore;
  if (ageHours < 1) ageScore = 0.9;           // < 1 hour
  else if (ageHours < 6) ageScore = 1.0;     // 1-6 hours (sweet spot)
  else if (ageHours < 24) ageScore = 0.7;    // 6-24 hours
  else ageScore = 0.4;                        // > 24 hours

  // Volume scoring
  const volumeScore = Math.min(token.transfers24h / 100, 1) * 0.3;
  
  // Smart money scoring
  const smartScore = smartMoney.score * 0.4;
  
  // Unique traders scoring
  const diversityScore = Math.min(token.uniqueTraders / 50, 1) * 0.3;
  
  // Total confidence
  const confidence = (ageScore * 0.3) + volumeScore + smartScore + (diversityScore * 0.1);
  
  return {
    confidence: Math.min(confidence, 1),
    ageScore,
    volumeScore,
    smartScore,
    diversityScore,
    recommendation: confidence > 0.8 ? 'STRONG_BUY' :
                   confidence > 0.6 ? 'BUY' :
                   confidence > 0.4 ? 'HOLD' : 'AVOID',
  };
}

// ==========================================
// BANKR API - TRADING EXECUTION
// ==========================================

/**
 * Execute trade via Bankr
 */
async function executeBankrTrade(token, action, amount = CONFIG.MAX_TRADE_SIZE) {
  const res = await fetch(`${BANKR_URL}/agent/prompt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': CONFIG.BANKR_API_KEY,
    },
    body: JSON.stringify({
      prompt: `${action} ${amount} ETH of ${token} on Base with 2% slippage`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Bankr API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Check job status
 */
async function checkBankrJob(jobId) {
  const res = await fetch(`${BANKR_URL}/agent/job/${jobId}`, {
    headers: {
      'X-API-Key': CONFIG.BANKR_API_KEY,
    },
  });

  if (!res.ok) {
    throw new Error(`Job check error: ${res.status}`);
  }

  return res.json();
}

/**
 * Poll job until complete
 */
async function pollBankrJob(jobId, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000));
    
    const status = await checkBankrJob(jobId);
    
    if (status.status === 'completed') return status;
    if (status.status === 'failed') throw new Error('Job failed');
  }
  
  throw new Error('Timeout waiting for job');
}

// ==========================================
// PORTFOLIO MANAGEMENT
// ==========================================

/**
 * Get current portfolio value
 */
async function getPortfolioValue() {
  const portfolio = [];
  let totalValue = 0;

  for (const [addr, pos] of positions) {
    if (pos.status !== 'open') continue;

    try {
      // Get current token balance
      const balances = await getTokenBalances(CONFIG.WALLET, [addr]);
      const balance = balances[0]?.tokenBalance || '0';
      const decimals = pos.decimals || 18;
      const formattedBalance = parseInt(balance, 16) / Math.pow(10, decimals);

      // Estimate current value (simplified)
      const currentValue = formattedBalance * pos.entryPrice; // Would need real price
      
      const pnl = ((currentValue - pos.entryValue) / pos.entryValue) * 100;

      portfolio.push({
        ...pos,
        currentBalance: formattedBalance.toFixed(4),
        currentValue: currentValue.toFixed(4),
        pnl: pnl.toFixed(2) + '%',
      });

      totalValue += currentValue;
    } catch (e) {
      console.error(`Error getting portfolio for ${addr}:`, e);
    }
  }

  return { portfolio, totalValue: totalValue.toFixed(4) };
}

/**
 * Check stop loss / take profit
 */
async function checkPositions() {
  const closed = [];

  for (const [addr, pos] of positions) {
    if (pos.status !== 'open') continue;

    // Get recent transfers to estimate price movement
    const transfers = await getAssetTransfers(addr, '0x' + (await getLatestBlock() - 100).toString(16));
    
    if (transfers.length === 0) continue;

    // Simple price estimation based on recent trade sizes
    const recentAvg = transfers.slice(0, 5).reduce((sum, t) => {
      return sum + (parseInt(t.value, 16) / 1e18);
    }, 0) / 5;

    const priceChange = ((recentAvg - pos.entryPrice) / pos.entryPrice) * 100;

    // Check SL/TP
    if (priceChange <= -CONFIG.STOP_LOSS * 100) {
      console.log(`🛑 Stop loss triggered for ${pos.symbol}: ${priceChange.toFixed(2)}%`);
      try {
        await executeBankrTrade(addr, 'sell');
        pos.status = 'closed';
        pos.closeReason = 'stop_loss';
        pos.closePrice = recentAvg;
        closed.push(pos);
      } catch (e) {
        console.error('Failed to execute stop loss:', e);
      }
    } else if (priceChange >= CONFIG.TAKE_PROFIT * 100) {
      console.log(`🎯 Take profit triggered for ${pos.symbol}: +${priceChange.toFixed(2)}%`);
      try {
        await executeBankrTrade(addr, 'sell');
        pos.status = 'closed';
        pos.closeReason = 'take_profit';
        pos.closePrice = recentAvg;
        closed.push(pos);
      } catch (e) {
        console.error('Failed to execute take profit:', e);
      }
    }
  }

  return closed;
}

// ==========================================
// HTTP SERVER & ROUTES
// ==========================================

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  // Parse body
  let body = '';
  req.on('data', chunk => body += chunk);
  await new Promise(resolve => req.on('end', resolve));
  const jsonBody = body ? JSON.parse(body) : {};

  // ========== HEALTH CHECK ==========
  if (path === '/' || path === '/health') {
    return res.end(JSON.stringify({
      status: 'operational',
      agent: 'Alpha Meme',
      version: '1.0.0',
      wallet: CONFIG.WALLET,
      environment: {
        alchemy: CONFIG.ALCHEMY_KEY ? 'connected' : 'missing',
        bankr: CONFIG.BANKR_API_KEY ? 'connected' : 'missing',
      },
      config: {
        maxTradeSize: CONFIG.MAX_TRADE_SIZE,
        minConfidence: CONFIG.MIN_CONFIDENCE,
        stopLoss: CONFIG.STOP_LOSS,
        takeProfit: CONFIG.TAKE_PROFIT,
      },
      timestamp: new Date().toISOString(),
    }));
  }

  // ========== SKILL MANIFEST ==========
  if (path === '/skill' || path === '/skill.md') {
    return res.end(JSON.stringify({
      name: 'Alpha Meme',
      description: 'AI agent for autonomous meme coin trading with smart money tracking using Alchemy API and Bankr execution on Base blockchain',
      version: '1.0.0',
      wallet: CONFIG.WALLET,
      category: 'trading',
      tags: ['meme', 'trading', 'base', 'ai', 'smart-money', 'alchemy', 'bankr', 'clanker'],
      
      skills: [
        {
          name: 'scan_opportunities',
          description: 'Scan Clanker tokens with smart money analysis via Alchemy',
          parameters: {
            limit: { type: 'number', default: 10 },
            minConfidence: { type: 'number', default: 0.7 },
          },
          pricing: { amount: '0.001', currency: 'ETH' },
        },
        {
          name: 'execute_trade',
          description: 'Execute buy/sell trade via Bankr API',
          parameters: {
            token: { type: 'string', required: true, description: 'Token contract address' },
            action: { type: 'string', required: true, enum: ['buy', 'sell'] },
            amount: { type: 'string', default: '0.01', description: 'ETH amount' },
          },
          pricing: { amount: '0.005', currency: 'ETH' },
        },
        {
          name: 'analyze_token',
          description: 'Deep smart money analysis of specific token',
          parameters: {
            token: { type: 'string', required: true },
          },
          pricing: { amount: '0.002', currency: 'ETH' },
        },
        {
          name: 'get_portfolio',
          description: 'Get current portfolio and positions',
          parameters: {},
          pricing: { amount: '0', currency: 'ETH' },
        },
        {
          name: 'monitor_positions',
          description: 'Check stop loss and take profit triggers',
          parameters: {},
          pricing: { amount: '0.001', currency: 'ETH' },
        },
      ],
      
      endpoints: {
        health: '/health',
        skill: '/skill',
        scan: '/scan',
        trade: '/trade',
        analyze: '/analyze',
        portfolio: '/portfolio',
        monitor: '/monitor',
        auto: '/auto',
        job: '/job/:id',
      },
      
      apis: {
        data: 'Alchemy (Base Mainnet)',
        execution: 'Bankr',
      },
    }, null, 2));
  }

  // ========== SCAN TOKENS ==========
  if (path === '/scan') {
    try {
      const limit = parseInt(parsedUrl.query.limit) || 10;
      const minConfidence = parseFloat(parsedUrl.query.minConfidence) || CONFIG.MIN_CONFIDENCE;
      
      console.log('🔍 Scanning Clanker tokens via Alchemy...');
      const tokens = await scanClankerTokens();
      
      console.log(`📊 Analyzing ${tokens.length} tokens...`);
      const analyzed = await Promise.all(
        tokens.slice(0, limit).map(async (token) => {
          const smartMoney = await analyzeSmartMoney(token.address);
          const scores = calculateTokenScore(token, smartMoney);
          return {
            ...token,
            smartMoney,
            ...scores,
          };
        })
      );

      const opportunities = analyzed.filter(a => a.confidence >= minConfidence);
      
      return res.end(JSON.stringify({
        success: true,
        scanned: tokens.length,
        analyzed: analyzed.length,
        opportunities: opportunities.length,
        dataSource: 'Alchemy',
        timestamp: new Date().toISOString(),
        opportunities: opportunities.map(o => ({
          address: o.address,
          symbol: o.symbol,
          name: o.name,
          confidence: o.confidence.toFixed(3),
          recommendation: o.recommendation,
          smartScore: o.smartScore.toFixed(3),
          ageScore: o.ageScore.toFixed(3),
          volume24h: o.volume24h,
          transfers24h: o.transfers24h,
          uniqueTraders: o.uniqueTraders,
          whales: o.smartMoney.whales,
          netFlow: o.smartMoney.netFlow,
        })),
        allTokens: analyzed.map(a => ({
          address: a.address,
          symbol: a.symbol,
          confidence: a.confidence,
          recommendation: a.recommendation,
        })),
      }));
    } catch (e) {
      console.error('Scan error:', e);
      res.writeHead(500);
      return res.end(JSON.stringify({ 
        success: false,
        error: e.message,
        stack: process.env.NODE_ENV === 'development' ? e.stack : undefined,
      }));
    }
  }

  // ========== EXECUTE TRADE ==========
  if (path === '/trade' && req.method === 'POST') {
    const { token, action, amount } = jsonBody;
    
    if (!token || !action) {
      res.writeHead(400);
      return res.end(JSON.stringify({ 
        success: false,
        error: 'Missing required fields: token, action' 
      }));
    }

    if (!['buy', 'sell'].includes(action)) {
      res.writeHead(400);
      return res.end(JSON.stringify({ 
        success: false,
        error: 'Action must be buy or sell' 
      }));
    }

    try {
      console.log(`🚀 Executing ${action} for ${token}...`);
      const result = await executeBankrTrade(token, action, amount);
      
      // Record position if buy
      if (action === 'buy' && result.jobId) {
        const tokenData = await getTokenMetadata(token);
        const position = {
          token,
          symbol: tokenData.symbol || 'Unknown',
          decimals: tokenData.decimals || 18,
          amount: amount || CONFIG.MAX_TRADE_SIZE,
          entry: Date.now(),
          entryPrice: 0, // Would get from execution result
          entryValue: parseFloat(amount || CONFIG.MAX_TRADE_SIZE),
          jobId: result.jobId,
          status: 'pending',
          stopLoss: parseFloat(amount || CONFIG.MAX_TRADE_SIZE) * (1 - CONFIG.STOP_LOSS),
          takeProfit: parseFloat(amount || CONFIG.MAX_TRADE_SIZE) * (1 + CONFIG.TAKE_PROFIT),
        };
        
        positions.set(token, position);
        
        // Start polling for completion
        pollBankrJob(result.jobId).then(status => {
          if (status.status === 'completed') {
            position.status = 'open';
            position.txHash = status.txHash;
            console.log(`✅ Buy completed: ${tokenData.symbol}`);
          }
        }).catch(err => {
          console.error(`❌ Buy failed for ${token}:`, err);
          position.status = 'failed';
        });
      }

      return res.end(JSON.stringify({
        success: true,
        message: `${action} order submitted`,
        token,
        amount: amount || CONFIG.MAX_TRADE_SIZE,
        jobId: result.jobId,
        status: result.status,
        checkStatus: `/job/${result.jobId}`,
      }));
    } catch (e) {
      console.error('Trade error:', e);
      res.writeHead(500);
      return res.end(JSON.stringify({ 
        success: false,
        error: e.message 
      }));
    }
  }

  // ========== CHECK JOB STATUS ==========
  if (path.startsWith('/job/')) {
    const jobId = path.split('/')[2];
    if (!jobId) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Missing job ID' }));
    }

    try {
      const status = await checkBankrJob(jobId);
      return res.end(JSON.stringify({
        success: true,
        jobId,
        ...status,
      }));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ 
        success: false,
        error: e.message 
      }));
    }
  }

  // ========== ANALYZE TOKEN ==========
  if (path === '/analyze' && req.method === 'POST') {
    const { token } = jsonBody;
    if (!token) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Missing token address' }));
    }

    try {
      console.log(`🔬 Analyzing ${token}...`);
      
      const [metadata, transfers, smartMoney] = await Promise.all([
        getTokenMetadata(token),
        getAssetTransfers(token),
        analyzeSmartMoney(token),
      ]);

      const scores = calculateTokenScore(
        { 
          address: token,
          transfers24h: transfers.length,
          uniqueTraders: new Set(transfers.map(t => t.from)).size + new Set(transfers.map(t => t.to)).size,
          createdAt: transfers[transfers.length - 1]?.metadata?.blockTimestamp || Date.now(),
        },
        smartMoney
      );

      return res.end(JSON.stringify({
        success: true,
        token,
        metadata,
        analysis: {
          transfers24h: transfers.length,
          smartMoney,
          scores,
        },
        recentActivity: transfers.slice(0, 10).map(t => ({
          from: t.from,
          to: t.to,
          value: (parseInt(t.value, 16) / 1e18).toFixed(4),
          hash: t.hash,
          time: t.metadata?.blockTimestamp,
        })),
        recommendation: scores.recommendation,
        timestamp: new Date().toISOString(),
      }));
    } catch (e) {
      console.error('Analyze error:', e);
      res.writeHead(500);
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // ========== GET PORTFOLIO ==========
  if (path === '/portfolio') {
    try {
      const { portfolio, totalValue } = await getPortfolioValue();
      
      return res.end(JSON.stringify({
        success: true,
        wallet: CONFIG.WALLET,
        totalPositions: positions.size,
        openPositions: Array.from(positions.values()).filter(p => p.status === 'open').length,
        totalValue,
        portfolio,
        tradeHistory: tradeHistory.slice(-20),
        timestamp: new Date().toISOString(),
      }));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // ========== MONITOR POSITIONS ==========
  if (path === '/monitor') {
    try {
      const closed = await checkPositions();
      
      return res.end(JSON.stringify({
        success: true,
        monitored: positions.size,
        closed: closed.length,
        closedPositions: closed,
        timestamp: new Date().toISOString(),
      }));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // ========== AUTO TRADING ==========
  if (path === '/auto') {
    try {
      console.log('🤖 Starting auto-scan and trade...');
      
      // Scan opportunities
      const tokens = await scanClankerTokens();
      const analyzed = await Promise.all(
        tokens.slice(0, 5).map(async (t) => {
          const smart = await analyzeSmartMoney(t.address);
          return { ...t, ...calculateTokenScore(t, smart), smart };
        })
      );

      // Filter high confidence
      const highConfidence = analyzed.filter(a => a.confidence > 0.8);
      const results = [];

      // Execute trades (max 2 per auto run)
      for (const token of highConfidence.slice(0, 2)) {
        try {
          console.log(`🎯 Auto-buying ${token.symbol} (confidence: ${token.confidence.toFixed(2)})`);
          const trade = await executeBankrTrade(token.address, 'buy', CONFIG.MAX_TRADE_SIZE);
          
          results.push({
            symbol: token.symbol,
            address: token.address,
            confidence: token.confidence,
            jobId: trade.jobId,
            status: 'submitted',
          });

          // Record position
          positions.set(token.address, {
            token: token.address,
            symbol: token.symbol,
            amount: CONFIG.MAX_TRADE_SIZE,
            entry: Date.now(),
            jobId: trade.jobId,
            status: 'pending',
            confidence: token.confidence,
          });
        } catch (err) {
          console.error(`Failed to buy ${token.symbol}:`, err);
          results.push({
            symbol: token.symbol,
            error: err.message,
          });
        }
      }

      return res.end(JSON.stringify({
        success: true,
        scanned: tokens.length,
        analyzed: analyzed.length,
        highConfidence: highConfidence.length,
        executed: results.length,
        results,
        timestamp: new Date().toISOString(),
      }));
    } catch (e) {
      console.error('Auto error:', e);
      res.writeHead(500);
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // ========== 404 ==========
  res.writeHead(404);
  res.end(JSON.stringify({
    success: false,
    error: 'Not found',
    availableEndpoints: [
      'GET  /health',
      'GET  /skill',
      'GET  /scan?limit=10&minConfidence=0.7',
      'POST /trade {token, action, amount}',
      'GET  /job/:jobId',
      'POST /analyze {token}',
      'GET  /portfolio',
      'GET  /monitor',
      'GET  /auto',
    ],
  }));
});

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
🚀 Alpha Meme AI Agent Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Wallet: ${CONFIG.WALLET}
🔮 Alchemy: ${CONFIG.ALCHEMY_KEY ? '✅ Connected' : '❌ Missing'}
🏦 Bankr: ${CONFIG.BANKR_API_KEY ? '✅ Connected' : '❌ Missing'}
🌐 Port: ${PORT}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Endpoints:
• Health:    http://localhost:${PORT}/health
• Skill:     http://localhost:${PORT}/skill
• Scan:      http://localhost:${PORT}/scan
• Trade:     http://localhost:${PORT}/trade
• Portfolio: http://localhost:${PORT}/portfolio
• Auto:      http://localhost:${PORT}/auto
  `);
});
