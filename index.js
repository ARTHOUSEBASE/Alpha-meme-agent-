/**
 * Alpha Meme AI Agent - Single File dengan Dashboard Transaksi
 * Wallet: 0x9C67140AdE64577ef6B40BeA6a801aDf1555a5E8
 * 
 * Dashboard: /dashboard
 * API: /api/*
 */

const http = require('http');
const url = require('url');

// ==========================================
// CONFIG
// ==========================================

const CONFIG = {
  WALLET: '0x9C67140AdE64577ef6B40BeA6a801aDf1555a5E8',
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  ALCHEMY_KEY: process.env.ALCHEMY_KEY,
  BANKR_API_KEY: process.env.BANKR_API_KEY,
  BASESCAN_KEY: process.env.BASESCAN_KEY,
  MAX_TRADE_SIZE: '0.01',
  MIN_CONFIDENCE: 0.7,
};

const ALCHEMY_URL = `https://base-mainnet.g.alchemy.com/v2/${CONFIG.ALCHEMY_KEY}`;
const BANKR_URL = 'https://api.bankr.bot';
const BASESCAN_API = 'https://api.basescan.org/api';

// Storage
const positions = new Map();
const transactions = new Map();
const tradeHistory = [];
const agentStats = { totalScans: 0, totalTrades: 0, successfulTrades: 0, failedTrades: 0, startTime: Date.now() };

// ==========================================
// DASHBOARD HTML - TINGGAL COPY
// ==========================================

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Alpha Meme Agent - Dashboard</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;color:#333}
.container{max-width:1200px;margin:0 auto;padding:20px}
.header{background:rgba(255,255,255,0.95);border-radius:20px;padding:30px;margin-bottom:20px;box-shadow:0 10px 40px rgba(0,0,0,0.1)}
.header h1{font-size:2.5em;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.wallet{font-family:monospace;background:#f0f0f0;padding:10px 15px;border-radius:10px;display:inline-block;margin-top:10px;font-size:0.9em}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:20px}
.stat-card{background:rgba(255,255,255,0.95);border-radius:15px;padding:25px;box-shadow:0 5px 20px rgba(0,0,0,0.1)}
.stat-label{color:#666;font-size:0.85em;text-transform:uppercase;letter-spacing:1px}
.stat-value{font-size:2em;font-weight:bold;color:#667eea;margin-top:10px}
.section{background:rgba(255,255,255,0.95);border-radius:20px;padding:30px;margin-bottom:20px;box-shadow:0 10px 40px rgba(0,0,0,0.1)}
.section h2{color:#667eea;margin-bottom:20px;font-size:1.3em}
table{width:100%;border-collapse:collapse;font-size:0.9em}
th,td{text-align:left;padding:12px;border-bottom:1px solid #e5e7eb}
th{color:#667eea;font-weight:600;font-size:0.8em;text-transform:uppercase}
tr:hover{background:#f9fafb}
.status-badge{display:inline-block;padding:5px 12px;border-radius:20px;font-size:0.75em;font-weight:bold}
.status-operational{background:#d1fae5;color:#065f46}
.status-pending{background:#fef3c7;color:#92400e}
.status-success{background:#d1fae5;color:#065f46}
.status-failed{background:#fee2e2;color:#991b1b}
.tx-hash{font-family:monospace;color:#667eea;text-decoration:none;font-size:0.85em}
.tx-hash:hover{text-decoration:underline}
.btn{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;text-decoration:none;display:inline-block;font-size:0.9em}
.empty-state{text-align:center;padding:40px;color:#666}
.refresh-btn{position:fixed;bottom:20px;right:20px;width:50px;height:50px;border-radius:50%;font-size:1.2em;box-shadow:0 5px 20px rgba(102,126,234,0.4)}
.api-status{display:flex;gap:15px;margin-top:15px;font-size:0.85em}
.api-item{display:flex;align-items:center;gap:5px}
.dot{width:8px;height:8px;border-radius:50%}
.dot-online{background:#10b981}.dot-offline{background:#ef4444}
@media(max-width:768px){.stats-grid{grid-template-columns:1fr}table{font-size:0.8em}th,td{padding:8px}}
</style></head>
<body>
<div class="container">
<div class="header">
<h1>🚀 Alpha Meme Agent</h1>
<p>Autonomous Meme Coin Trading Dashboard</p>
<div class="wallet">💰 ${CONFIG.WALLET}</div>
<div class="api-status">
<div class="api-item"><div class="dot ${CONFIG.ALCHEMY_KEY?'dot-online':'dot-offline'}"></div><span>Alchemy</span></div>
<div class="api-item"><div class="dot ${CONFIG.BANKR_API_KEY?'dot-online':'dot-offline'}"></div><span>Bankr</span></div>
<div class="api-item"><div class="dot ${CONFIG.BASESCAN_KEY?'dot-online':'dot-offline'}"></div><span>Basescan</span></div>
</div>
</div>
<div class="stats-grid">
<div class="stat-card"><div class="stat-label">Total Scans</div><div class="stat-value" id="scans">0</div></div>
<div class="stat-card"><div class="stat-label">Total Trades</div><div class="stat-value" id="trades">0</div></div>
<div class="stat-card"><div class="stat-label">Success Rate</div><div class="stat-value" id="rate">0%</div></div>
<div class="stat-card"><div class="stat-label">Open Positions</div><div class="stat-value" id="open">0</div></div>
<div class="stat-card"><div class="stat-label">Transactions</div><div class="stat-value" id="txs">0</div></div>
<div class="stat-card"><div class="stat-label">Uptime</div><div class="stat-value" id="uptime">0h</div></div>
</div>
<div class="section"><h2>📊 Live Positions</h2><div id="positions"><div class="empty-state">No active positions</div></div></div>
<div class="section"><h2>📝 Recent Transactions</h2><div id="transactions"><div class="empty-state">No transactions</div></div></div>
<div class="section"><h2>📈 Trade History</h2><div id="history"><div class="empty-state">No history</div></div></div>
<div class="section"><h2>🔧 Quick Actions</h2>
<a href="/api/scan" class="btn" target="_blank">🔍 Scan Now</a>
<a href="/api/auto" class="btn" target="_blank" style="margin-left:10px">🤖 Auto Trade</a>
<a href="/api/wallet" class="btn" target="_blank" style="margin-left:10px">💰 Wallet</a>
</div>
</div>
<button class="btn refresh-btn" onclick="loadAll()">🔄</button>
<script>
async function loadStats(){
const res=await fetch('/api/stats');const data=await res.json();
document.getElementById('scans').textContent=data.totalScans;
document.getElementById('trades').textContent=data.totalTrades;
document.getElementById('rate').textContent=data.successRate+'%';
document.getElementById('open').textContent=data.openPositions;
document.getElementById('txs').textContent=data.totalTransactions;
document.getElementById('uptime').textContent=data.uptime;
}
async function loadPositions(){
const res=await fetch('/api/positions');const data=await res.json();
if(data.positions.length===0){document.getElementById('positions').innerHTML='<div class="empty-state">No active positions</div>';return}
let html='<table><tr><th>Token</th><th>Action</th><th>Amount</th><th>Status</th><th>Time</th></tr>';
data.positions.forEach(p=>{
html+=\`<tr><td>\${p.token.slice(0,10)}...</td><td>\${p.action}</td><td>\${p.amount} ETH</td><td><span class="status-badge status-\${p.status}">\${p.status}</span></td><td>\${new Date(p.entry).toLocaleTimeString()}</td></tr>\`;
});
html+='</table>';document.getElementById('positions').innerHTML=html;
}
async function loadTransactions(){
const res=await fetch('/api/transactions');const data=await res.json();
if(data.transactions.length===0){document.getElementById('transactions').innerHTML='<div class="empty-state">No transactions</div>';return}
let html='<table><tr><th>Hash</th><th>Status</th><th>Checked</th><th>Link</th></tr>';
data.transactions.forEach(t=>{
html+=\`<tr><td><a href="https://basescan.org/tx/\${t.hash}" target="_blank" class="tx-hash">\${t.hash.slice(0,20)}...</a></td><td><span class="status-badge status-\${t.status}">\${t.status}</span></td><td>\${new Date(t.checkedAt).toLocaleTimeString()}</td><td><a href="/api/tx/\${t.hash}" class="btn" style="padding:5px 10px;font-size:0.8em">Details</a></td></tr>\`;
});
html+='</table>';document.getElementById('transactions').innerHTML=html;
}
async function loadHistory(){
const res=await fetch('/api/history');const data=await res.json();
if(data.history.length===0){document.getElementById('history').innerHTML='<div class="empty-state">No history</div>';return}
let html='<table><tr><th>Time</th><th>Token</th><th>Action</th><th>Amount</th><th>Status</th></tr>';
data.history.forEach(h=>{
html+=\`<tr><td>\${new Date(h.time).toLocaleTimeString()}</td><td>\${h.token.slice(0,10)}...</td><td>\${h.action}</td><td>\${h.amount} ETH</td><td><span class="status-badge status-\${h.status}">\${h.status}</span></td></tr>\`;
});
html+='</table>';document.getElementById('history').innerHTML=html;
}
function loadAll(){loadStats();loadPositions();loadTransactions();loadHistory();}
loadAll();setInterval(loadAll,30000);
</script>
</body></html>`;

// ==========================================
// API FUNCTIONS
// ==========================================

async function getLatestBlock() {
  const res = await fetch(ALCHEMY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
  });
  const data = await res.json();
  return parseInt(data.result, 16);
}

async function getTransactionStatus(txHash) {
  try {
    const res = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [txHash] }),
    });
    const data = await res.json();
    const receipt = data.result;
    if (!receipt) return { status: 'pending', found: false };
    return {
      status: receipt.status === '0x1' ? 'success' : 'failed',
      blockNumber: parseInt(receipt.blockNumber, 16),
      gasUsed: parseInt(receipt.gasUsed, 16),
      found: true,
      from: receipt.from,
      to: receipt.to,
      txHash: receipt.transactionHash,
    };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

async function getTokenMetadata(contractAddress) {
  const res = await fetch(`${ALCHEMY_URL}/getTokenMetadata?contractAddress=${contractAddress}`);
  return res.json();
}

async function getAssetTransfers(contractAddress, fromBlock) {
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'alchemy_getAssetTransfers',
    params: [{
      fromBlock: fromBlock || '0x' + (await getLatestBlock() - 1000).toString(16),
      toBlock: 'latest',
      contractAddresses: [contractAddress],
      category: ['erc20'],
      withMetadata: true,
      maxCount: '0x64',
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

async function scanClankerTokens() {
  const CLANKER_FACTORY = '0x375C15db32D28cEcdcAB5C03Ab889bf15cbD2c5E';
  const latestBlock = await getLatestBlock();
  const fromBlock = '0x' + (latestBlock - 2000).toString(16);
  
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_getLogs',
    params: [{
      address: CLANKER_FACTORY,
      fromBlock,
      toBlock: 'latest',
      topics: [],
    }],
  };
  
  const res = await fetch(ALCHEMY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  const data = await res.json();
  const logs = data.result || [];
  const tokenAddresses = [...new Set(logs.map(log => log.address))];
  
  const tokens = await Promise.all(
    tokenAddresses.slice(0, 10).map(async (addr) => {
      try {
        const metadata = await getTokenMetadata(addr);
        const transfers = await getAssetTransfers(addr, fromBlock);
        const uniqueTraders = new Set(transfers.map(t => t.from)).size + new Set(transfers.map(t => t.to)).size;
        return {
          address: addr,
          name: metadata.name || 'Unknown',
          symbol: metadata.symbol || 'UNK',
          transfers24h: transfers.length,
          uniqueTraders,
          confidence: Math.min(transfers.length / 50, 1),
        };
      } catch (e) { return null; }
    })
  );
  
  return tokens.filter(t => t !== null && t.symbol !== 'UNK');
}

async function analyzeSmartMoney(tokenAddress) {
  const fromBlock = '0x' + (await getLatestBlock() - 4000).toString(16);
  const transfers = await getAssetTransfers(tokenAddress, fromBlock);
  if (transfers.length === 0) return { score: 0.3, activity: 'low' };
  
  const whales = transfers.filter(t => parseInt(t.value, 16) / 1e18 > 1000);
  const uniqueBuyers = new Set(whales.map(t => t.to)).size;
  const score = Math.min(whales.length / 10, 1);
  
  return { score, whales: whales.length, uniqueWhales: uniqueBuyers, activity: transfers.length > 50 ? 'high' : 'medium' };
}

async function executeBankrTrade(token, action, amount = CONFIG.MAX_TRADE_SIZE) {
  const res = await fetch(`${BANKR_URL}/agent/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': CONFIG.BANKR_API_KEY },
    body: JSON.stringify({ prompt: `${action} ${amount} ETH of ${token} on Base with 2% slippage` }),
  });
  if (!res.ok) throw new Error(`Bankr error: ${res.status}`);
  const result = await res.json();
  
  agentStats.totalTrades++;
  tradeHistory.push({
    time: Date.now(),
    token,
    action,
    amount,
    status: 'pending',
    jobId: result.jobId,
  });
  
  return result;
}

async function checkBankrJob(jobId) {
  const res = await fetch(`${BANKR_URL}/agent/job/${jobId}`, {
    headers: { 'X-API-Key': CONFIG.BANKR_API_KEY },
  });
  return res.json();
}

// ==========================================
// HTTP SERVER
// ==========================================

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  await new Promise(resolve => req.on('end', resolve));
  const jsonBody = body ? JSON.parse(body) : {};

  // ========== DASHBOARD ==========
  if (path === '/' || path === '/dashboard') {
    res.setHeader('Content-Type', 'text/html');
    return res.end(DASHBOARD_HTML);
  }

  // ========== API STATS ==========
  if (path === '/api/stats') {
    const openPos = Array.from(positions.values()).filter(p => p.status === 'open').length;
    const uptime = Math.floor((Date.now() - agentStats.startTime) / 3600000);
    return res.end(JSON.stringify({
      ...agentStats,
      openPositions: openPos,
      totalTransactions: transactions.size,
      uptime: uptime + 'h',
      successRate: agentStats.totalTrades > 0 ? Math.round((agentStats.successfulTrades / agentStats.totalTrades) * 100) : 0,
    }));
  }

  // ========== API POSITIONS ==========
  if (path === '/api/positions') {
    return res.end(JSON.stringify({
      count: positions.size,
      positions: Array.from(positions.values()),
    }));
  }

  // ========== API TRANSACTIONS ==========
  if (path === '/api/transactions') {
    return res.end(JSON.stringify({
      count: transactions.size,
      transactions: Array.from(transactions.values()).reverse(),
    }));
  }

  // ========== API HISTORY ==========
  if (path === '/api/history') {
    return res.end(JSON.stringify({
      count: tradeHistory.length,
      history: tradeHistory.slice(-50).reverse(),
    }));
  }

  // ========== API HEALTH ==========
  if (path === '/api/health') {
    return res.end(JSON.stringify({
      status: 'operational',
      agent: 'Alpha Meme',
      wallet: CONFIG.WALLET,
      env: {
        alchemy: CONFIG.ALCHEMY_KEY ? 'ok' : 'missing',
        bankr: CONFIG.BANKR_API_KEY ? 'ok' : 'missing',
        basescan: CONFIG.BASESCAN_KEY ? 'ok' : 'optional',
      },
    }));
  }

  // ========== API SKILL ==========
  if (path === '/api/skill' || path === '/skill.md') {
    return res.end(JSON.stringify({
      name: 'Alpha Meme',
      description: 'AI agent for meme coin trading with dashboard',
      version: '1.0.0',
      wallet: CONFIG.WALLET,
      dashboard: '/dashboard',
      endpoints: ['/api/health', '/api/stats', '/api/positions', '/api/transactions', '/api/history', '/api/scan', '/api/trade', '/api/tx/:hash'],
    }));
  }

  // ========== API SCAN ==========
  if (path === '/api/scan') {
    try {
      agentStats.totalScans++;
      const tokens = await scanClankerTokens();
      const analyzed = await Promise.all(
        tokens.map(async (t) => {
          const smart = await analyzeSmartMoney(t.address);
          return { ...t, smartScore: smart.score, totalScore: (t.confidence * 0.6) + (smart.score * 0.4) };
        })
      );
      return res.end(JSON.stringify({
        scanned: tokens.length,
        opportunities: analyzed.filter(a => a.totalScore > 0.7).sort((a, b) => b.totalScore - a.totalScore),
      }));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // ========== API TRADE ==========
  if (path === '/api/trade' && req.method === 'POST') {
    const { token, action, amount } = jsonBody;
    if (!token || !action) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Missing token or action' }));
    }
    try {
      const result = await executeBankrTrade(token, action, amount);
      if (result.jobId) {
        positions.set(token, {
          token, action, amount: amount || CONFIG.MAX_TRADE_SIZE,
          entry: Date.now(), jobId: result.jobId, status: 'pending',
        });
      }
      return res.end(JSON.stringify({ success: true, jobId: result.jobId, status: result.status }));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // ========== API CHECK TX ==========
  if (path === '/api/tx' && req.method === 'POST') {
    const { txHash } = jsonBody;
    if (!txHash) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Missing txHash' }));
    }
    try {
      const status = await getTransactionStatus(txHash);
      transactions.set(txHash, { hash: txHash, status: status.status, checkedAt: Date.now() });
      return res.end(JSON.stringify({ success: true, txHash, ...status, explorer: `https://basescan.org/tx/${txHash}` }));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  if (path.startsWith('/api/tx/')) {
    const txHash = path.split('/')[3];
    try {
      const status = await getTransactionStatus(txHash);
      return res.end(JSON.stringify({ success: true, txHash, ...status }));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // ========== API JOB ==========
  if (path.startsWith('/api/job/')) {
    const jobId = path.split('/')[3];
    try {
      const status = await checkBankrJob(jobId);
      return res.end(JSON.stringify({ success: true, ...status }));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // ========== API AUTO ==========
  if (path === '/api/auto') {
    try {
      const tokens = await scanClankerTokens();
      const analyzed = await Promise.all(
        tokens.slice(0, 5).map(async (t) => {
          const smart = await analyzeSmartMoney(t.address);
          return { ...t, totalScore: (t.confidence * 0.6) + (smart.score * 0.4), smart };
        })
      );
      const highConfidence = analyzed.filter(a => a.totalScore > 0.8);
      const results = [];
      for (const token of highConfidence.slice(0, 2)) {
        const trade = await executeBankrTrade(token.address, 'buy', CONFIG.MAX_TRADE_SIZE);
        results.push({ symbol: token.symbol, score: token.totalScore, jobId: trade.jobId });
      }
      return res.end(JSON.stringify({ success: true, scanned: tokens.length, traded: results.length, results }));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // ========== 404 ==========
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found', dashboard: '/dashboard', api: '/api/health' }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
🚀 Alpha Meme Agent with Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Wallet: ${CONFIG.WALLET}
🌐 Port: ${PORT}

Dashboard: http://localhost:${PORT}/dashboard
API:       http://localhost:${PORT}/api/health
Stats:     http://localhost:${PORT}/api/stats
  `);
});
