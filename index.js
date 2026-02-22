/**
 * Alpha Meme AI Agent - Single File Complete
 * Wallet: 0x9C67140AdE64577ef6B40BeA6a801aDf1555a5E8
 * Deploy: railway.app (New Project → Deploy from GitHub)
 * 
 * Environment Variables:
 * PRIVATE_KEY=0x...(wallet private key)
 * ALCHEMY_KEY=...(from alchemy.com - Base Mainnet)
 * BANKR_API_KEY=...(from bankr.bot)
 * BASESCAN_KEY=...(optional, from basescan.org)
 */

const http = require('http');
const url = require('url');

// ==========================================
// CONFIGURATION
// ==========================================

const CONFIG = {
  WALLET: '0x9C67140AdE64577ef6B40BeA6a801aDf1555a5E8',
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  ALCHEMY_KEY: process.env.ALCHEMY_KEY,
  BANKR_API_KEY: process.env.BANKR_API_KEY,
  BASESCAN_KEY: process.env.BASESCAN_KEY,
  
  MAX_TRADE_SIZE: '0.01',
  MIN_CONFIDENCE: 0.7,
  STOP_LOSS: 0.20,
  TAKE_PROFIT: 0.50,
};

const ALCHEMY_URL = `https://base-mainnet.g.alchemy.com/v2/${CONFIG.ALCHEMY_KEY}`;
const BANKR_URL = 'https://api.bankr.bot';
const BASESCAN_API = 'https://api.basescan.org/api';
const CLANKER_FACTORY = '0x375C15db32D28cEcdcAB5C03Ab889bf15cbD2c5E';

// Storage
const positions = new Map();
const transactions = new Map();
const tradeHistory = [];
const agentStats = {
  totalScans: 0,
  totalTrades: 0,
  successfulTrades: 0,
  failedTrades: 0,
  startTime: Date.now(),
};

// ==========================================
// DASHBOARD HTML (Embedded)
// ==========================================

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Alpha Meme Agent - Dashboard</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;color:#333}
.container{max-width:1200px;margin:0 auto;padding:20px}
.header{background:rgba(255,255,255,0.95);border-radius:20px;padding:30px;margin-bottom:20px;box-shadow:0 10px 40px rgba(0,0,0,0.1)}
.header h1{font-size:2.5em;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:10px}
.wallet{font-family:monospace;background:#f0f0f0;padding:10px 15px;border-radius:10px;display:inline-block;margin-top:10px;font-size:0.85em;word-break:break-all}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:20px}
.stat-card{background:rgba(255,255,255,0.95);border-radius:15px;padding:25px;box-shadow:0 5px 20px rgba(0,0,0,0.1);transition:transform 0.3s}
.stat-card:hover{transform:translateY(-5px)}.stat-label{color:#666;font-size:0.85em;text-transform:uppercase;letter-spacing:1px}
.stat-value{font-size:2.2em;font-weight:bold;color:#667eea;margin-top:10px}.stat-change{font-size:0.9em;margin-top:5px;color:#666}
.section{background:rgba(255,255,255,0.95);border-radius:20px;padding:30px;margin-bottom:20px;box-shadow:0 10px 40px rgba(0,0,0,0.1)}
.section h2{color:#667eea;margin-bottom:20px;font-size:1.3em;display:flex;align-items:center;gap:10px}
table{width:100%;border-collapse:collapse;font-size:0.9em}th,td{text-align:left;padding:12px;border-bottom:1px solid #e5e7eb}
th{color:#667eea;font-weight:600;font-size:0.8em;text-transform:uppercase}tr:hover{background:#f9fafb}
.status-badge{display:inline-block;padding:5px 12px;border-radius:20px;font-size:0.75em;font-weight:bold}
.status-operational{background:#d1fae5;color:#065f46}.status-pending{background:#fef3c7;color:#92400e}
.status-success{background:#d1fae5;color:#065f46}.status-failed{background:#fee2e2;color:#991b1b}
.status-open{background:#dbeafe;color:#1e40af}.status-closed{background:#e5e7eb;color:#374151}
.tx-hash{font-family:monospace;color:#667eea;text-decoration:none;font-size:0.8em;word-break:break-all}
.tx-hash:hover{text-decoration:underline}.btn{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;padding:12px 25px;border-radius:10px;cursor:pointer;font-size:1em;transition:opacity 0.3s;text-decoration:none;display:inline-block}
.btn:hover{opacity:0.9}.btn-small{padding:8px 15px;font-size:0.85em}.empty-state{text-align:center;padding:40px;color:#666}
.refresh-btn{position:fixed;bottom:30px;right:30px;width:60px;height:60px;border-radius:50%;font-size:1.5em;box-shadow:0 5px 20px rgba(102,126,234,0.4);z-index:1000}
.api-status{display:flex;gap:15px;margin-top:15px;font-size:0.85em;flex-wrap:wrap}
.api-item{display:flex;align-items:center;gap:5px}.dot{width:8px;height:8px;border-radius:50%}
.dot-online{background:#10b981}.dot-offline{background:#ef4444}.progress-bar{width:100%;height:6px;background:#e5e7eb;border-radius:3px;margin-top:8px;overflow:hidden}
.progress-fill{height:100%;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);transition:width 0.3s}
.token-icon{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:inline-flex;align-items:center;justify-content:center;color:white;font-weight:bold;margin-right:10px;font-size:0.9em}
.confidence-high{color:#10b981;font-weight:bold}.confidence-medium{color:#f59e0b;font-weight:bold}.confidence-low{color:#ef4444}
@media(max-width:768px){.stats-grid{grid-template-columns:1fr}.header h1{font-size:1.8em}.wallet{font-size:0.75em}table{font-size:0.8em}th,td{padding:8px}.section{padding:20px}}
</style></head>
<body>
<div class="container">
<div class="header">
<h1>🚀 Alpha Meme Agent</h1>
<p>Autonomous Meme Coin Trading Dashboard</p>
<div class="wallet">💰 Wallet: ${CONFIG.WALLET}</div>
<div class="api-status">
<div class="api-item"><div class="dot ${CONFIG.ALCHEMY_KEY?'dot-online':'dot-offline'}"></div><span>Alchemy ${CONFIG.ALCHEMY_KEY?'✅':'❌'}</span></div>
<div class="api-item"><div class="dot ${CONFIG.BANKR_API_KEY?'dot-online':'dot-offline'}"></div><span>Bankr ${CONFIG.BANKR_API_KEY?'✅':'❌'}</span></div>
<div class="api-item"><div class="dot ${CONFIG.BASESCAN_KEY?'dot-online':'dot-offline'}"></div><span>Basescan ${CONFIG.BASESCAN_KEY?'✅ (Optional)':'❌ (Optional)'}</span></div>
</div>
</div>
<div class="stats-grid">
<div class="stat-card"><div class="stat-label">📊 Total Scans</div><div class="stat-value" id="scans">0</div><div class="stat-change">All time</div></div>
<div class="stat-card"><div class="stat-label">💹 Total Trades</div><div class="stat-value" id="trades">0</div><div class="progress-bar"><div class="progress-fill" id="tradeProgress" style="width:0%"></div></div></div>
<div class="stat-card"><div class="stat-label">🎯 Success Rate</div><div class="stat-value" id="rate">0%</div><div class="stat-change" id="successText">0 successful</div></div>
<div class="stat-card"><div class="stat-label">📈 Open Positions</div><div class="stat-value" id="open">0</div><div class="stat-change">Active now</div></div>
<div class="stat-card"><div class="stat-label">📝 Transactions</div><div class="stat-value" id="txs">0</div><div class="stat-change">Checked</div></div>
<div class="stat-card"><div class="stat-label">⏱️ Uptime</div><div class="stat-value" id="uptime">0h</div><div class="stat-change">Since start</div></div>
</div>
<div class="section"><h2>🔥 Live Positions</h2><div id="positions"><div class="empty-state">No active positions. Click "Auto Trade" to start.</div></div></div>
<div class="section"><h2>🕐 Recent Transactions</h2><div id="transactions"><div class="empty-state">No transactions checked yet.</div></div></div>
<div class="section"><h2>📚 Trade History</h2><div id="history"><div class="empty-state">No trade history. Start trading to see records.</div></div></div>
<div class="section"><h2>⚡ Quick Actions</h2>
<a href="/api/scan" class="btn" target="_blank">🔍 Scan Tokens</a>
<a href="/api/auto" class="btn" target="_blank" style="margin-left:10px">🤖 Auto Trade</a>
<a href="/api/wallet" class="btn" target="_blank" style="margin-left:10px">💰 Check Wallet</a>
<a href="/api/health" class="btn btn-small" target="_blank" style="margin-left:10px">🏥 Health</a>
</div>
<div class="section"><h2>📖 API Documentation</h2>
<table>
<tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
<tr><td>GET</td><td><code>/dashboard</code></td><td>This dashboard</td></tr>
<tr><td>GET</td><td><code>/api/health</code></td><td>Health check & status</td></tr>
<tr><td>GET</td><td><code>/api/stats</code></td><td>Statistics JSON</td></tr>
<tr><td>GET</td><td><code>/api/positions</code></td><td>Active positions</td></tr>
<tr><td>GET</td><td><code>/api/transactions</code></td><td>Checked transactions</td></tr>
<tr><td>GET</td><td><code>/api/history</code></td><td>Trade history</td></tr>
<tr><td>GET</td><td><code>/api/scan</code></td><td>Scan Clanker tokens</td></tr>
<tr><td>POST</td><td><code>/api/trade</code></td><td>Execute trade {token,action,amount}</td></tr>
<tr><td>GET</td><td><code>/api/job/:id</code></td><td>Check job status</td></tr>
<tr><td>POST</td><td><code>/api/tx</code></td><td>Check transaction {txHash}</td></tr>
<tr><td>GET</td><td><code>/api/tx/:hash</code></td><td>Get transaction details</td></tr>
<tr><td>GET</td><td><code>/api/auto</code></td><td>Auto scan & trade</td></tr>
<tr><td>GET</td><td><code>/api/wallet</code></td><td>Wallet portfolio</td></tr>
<tr><td>GET</td><td><code>/api/skill</code></td><td>OpenAgent manifest</td></tr>
</table>
</div>
</div>
<button class="btn refresh-btn" onclick="loadAll()" title="Refresh Data">🔄</button>
<script>
async function loadStats(){
try{const res=await fetch('/api/stats');const data=await res.json();
document.getElementById('scans').textContent=data.totalScans;
document.getElementById('trades').textContent=data.totalTrades;
document.getElementById('rate').textContent=data.successRate+'%';
document.getElementById('successText').textContent=data.successfulTrades+' successful, '+data.failedTrades+' failed';
document.getElementById('open').textContent=data.openPositions;
document.getElementById('txs').textContent=data.totalTransactions;
document.getElementById('uptime').textContent=data.uptime;
const progress=data.totalTrades>0?(data.successfulTrades/data.totalTrades*100):0;
document.getElementById('tradeProgress').style.width=progress+'%';
}catch(e){console.error('Stats error:',e)}}

async function loadPositions(){
try{const res=await fetch('/api/positions');const data=await res.json();
if(data.positions.length===0){document.getElementById('positions').innerHTML='<div class="empty-state">No active positions. Click "Auto Trade" to start.</div>';return}
let html='<table><tr><th>Token</th><th>Action</th><th>Amount</th><th>Status</th><th>Job ID</th><th>Time</th></tr>';
data.positions.forEach(p=>{
const statusClass=p.status==='open'?'status-open':p.status==='pending'?'status-pending':p.status==='closed'?'status-closed':'status-pending';
html+=\`<tr><td><span class="token-icon">\${p.symbol?p.symbol[0]:'?'}</span>\${p.symbol||p.token.slice(0,10)+'...'}</td><td>\${p.action.toUpperCase()}</td><td>\${p.amount} ETH</td><td><span class="status-badge \${statusClass}">\${p.status}</span></td><td><a href="/api/job/\${p.jobId}" class="tx-hash" target="_blank">\${p.jobId.slice(0,15)}...</a></td><td>\${new Date(p.entry).toLocaleString()}</td></tr>\`;
});
html+='</table>';document.getElementById('positions').innerHTML=html;
}catch(e){console.error('Positions error:',e)}}

async function loadTransactions(){
try{const res=await fetch('/api/transactions');const data=await res.json();
if(data.transactions.length===0){document.getElementById('transactions').innerHTML='<div class="empty-state">No transactions checked yet.</div>';return}
let html='<table><tr><th>Transaction Hash</th><th>Status</th><th>Checked At</th><th>Actions</th></tr>';
data.transactions.forEach(t=>{
const statusClass=t.status==='success'?'status-success':t.status==='failed'?'status-failed':'status-pending';
html+=\`<tr><td><a href="https://basescan.org/tx/\${t.hash}" target="_blank" class="tx-hash">\${t.hash}</a></td><td><span class="status-badge \${statusClass}">\${t.status}</span></td><td>\${new Date(t.checkedAt).toLocaleString()}</td><td><a href="/api/tx/\${t.hash}" class="btn btn-small" target="_blank">Details</a></td></tr>\`;
});
html+='</table>';document.getElementById('transactions').innerHTML=html;
}catch(e){console.error('Transactions error:',e)}}

async function loadHistory(){
try{const res=await fetch('/api/history');const data=await res.json();
if(data.history.length===0){document.getElementById('history').innerHTML='<div class="empty-state">No trade history. Start trading to see records.</div>';return}
let html='<table><tr><th>Time</th><th>Token</th><th>Action</th><th>Amount</th><th>Status</th></tr>';
data.history.forEach(h=>{
const statusClass=h.status==='success'?'status-success':h.status==='failed'?'status-failed':'status-pending';
html+=\`<tr><td>\${new Date(h.time).toLocaleString()}</td><td><span class="token-icon">\${h.symbol?h.symbol[0]:'?'}</span>\${h.symbol||h.token.slice(0,10)+'...'}</td><td>\${h.action.toUpperCase()}</td><td>\${h.amount} ETH</td><td><span class="status-badge \${statusClass}">\${h.status}</span></td></tr>\`;
});
html+='</table>';document.getElementById('history').innerHTML=html;
}catch(e){console.error('History error:',e)}}

function loadAll(){loadStats();loadPositions();loadTransactions();loadHistory();}
loadAll();setInterval(loadAll,30000);
</script>
</body></html>`;

// ==========================================
// ALCHEMY API FUNCTIONS
// ==========================================

async function alchemyRequest(method, params = []) {
  const res = await fetch(ALCHEMY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const data = await res.json();
  return data.result;
}

async function getLatestBlock() {
  const result = await alchemyRequest('eth_blockNumber');
  return parseInt(result, 16);
}

async function getTokenMetadata(contractAddress) {
  const res = await fetch(`${ALCHEMY_URL}/getTokenMetadata?contractAddress=${contractAddress}`);
  return res.json();
}

async function getAssetTransfers(contractAddress, fromBlock, toBlock = 'latest') {
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'alchemy_getAssetTransfers',
    params: [{
      fromBlock: fromBlock || '0x' + (await getLatestBlock() - 1000).toString(16),
      toBlock,
      contractAddresses: contractAddress ? [contractAddress] : [],
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

async function getTransactionReceipt(txHash) {
  return await alchemyRequest('eth_getTransactionReceipt', [txHash]);
}

async function getLogs(address, fromBlock, topics = []) {
  const params = [{
    address,
    fromBlock: fromBlock || '0x' + (await getLatestBlock() - 500).toString(16),
    toBlock: 'latest',
    topics: topics.length > 0 ? topics : undefined,
  }];
  return await alchemyRequest('eth_getLogs', params);
}

async function getBalance(address) {
  const result = await alchemyRequest('eth_getBalance', [address, 'latest']);
  return parseInt(result, 16) / 1e18;
}

async function getTokenBalances(address) {
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'alchemy_getTokenBalances',
    params: [address],
  };
  const res = await fetch(ALCHEMY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return data.result?.tokenBalances || [];
}

// ==========================================
// BANKR API FUNCTIONS
// ==========================================

async function bankrTrade(token, action, amount = CONFIG.MAX_TRADE_SIZE) {
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
  if (!res.ok) throw new Error(`Bankr error: ${res.status}`);
  return res.json();
}

async function checkBankrJob(jobId) {
  const res = await fetch(`${BANKR_URL}/agent/job/${jobId}`, {
    headers: { 'X-API-Key': CONFIG.BANKR_API_KEY },
  });
  if (!res.ok) throw new Error(`Job check error: ${res.status}`);
  return res.json();
}

// ==========================================
// CLANKER SCANNER
// ==========================================

async function scanClankerTokens() {
  try {
    const latestBlock = await getLatestBlock();
    const fromBlock = '0x' + (latestBlock - 2000).toString(16);
    
    // Get logs from Clanker factory
    const logs = await getLogs(CLANKER_FACTORY, fromBlock);
    const tokenAddresses = [...new Set(logs.map(log => log.address).filter(a => a && a !== '0x0000000000000000000000000000000000000000'))];
    
    const tokens = await Promise.all(
      tokenAddresses.slice(0, 15).map(async (addr) => {
        try {
          const [metadata, transfers] = await Promise.all([
            getTokenMetadata(addr),
            getAssetTransfers(addr, fromBlock),
          ]);
          
          const uniqueSenders = new Set(transfers.map(t => t.from?.toLowerCase())).size;
          const uniqueReceivers = new Set(transfers.map(t => t.to?.toLowerCase())).size;
          const volume = transfers.reduce((sum, t) => sum + (parseInt(t.value, 16) / 1e18 || 0), 0);
          
          return {
            address: addr,
            name: metadata.name || 'Unknown',
            symbol: metadata.symbol || 'UNK',
            decimals: metadata.decimals || 18,
            logo: metadata.logo,
            totalSupply: metadata.totalSupply,
            transfers24h: transfers.length,
            uniqueTraders: uniqueSenders + uniqueReceivers,
            volume24h: volume.toFixed(4),
            deployer: transfers[0]?.from || 'Unknown',
            createdAt: transfers[0]?.metadata?.blockTimestamp || Date.now(),
          };
        } catch (e) {
          return null;
        }
      })
    );
    
    return tokens.filter(t => t !== null && t.symbol !== 'UNK' && t.name !== 'Unknown');
  } catch (e) {
    console.error('Scan error:', e);
    return [];
  }
}

// ==========================================
// SMART MONEY ANALYSIS
// ==========================================

async function analyzeSmartMoney(tokenAddress) {
  try {
    const fromBlock = '0x' + (await getLatestBlock() - 4000).toString(16);
    const transfers = await getAssetTransfers(tokenAddress, fromBlock);
    
    if (transfers.length === 0) {
      return { score: 0.3, activity: 'low', whales: 0, uniqueWhales: 0 };
    }
    
    // Whale detection (> 1000 tokens)
    const whales = transfers.filter(t => {
      const value = parseInt(t.value, 16) / 1e18;
      return value > 1000;
    });
    
    const uniqueBuyers = new Set(whales.filter(t => t.to).map(t => t.to.toLowerCase()));
    const uniqueSellers = new Set(whales.filter(t => t.from).map(t => t.from.toLowerCase()));
    
    const buyVolume = whales.filter(t => t.to).reduce((sum, t) => sum + (parseInt(t.value, 16) / 1e18 || 0), 0);
    const sellVolume = whales.filter(t => t.from).reduce((sum, t) => sum + (parseInt(t.value, 16) / 1e18 || 0), 0);
    
    const netFlow = buyVolume - sellVolume;
    const totalVolume = buyVolume + sellVolume;
    const flowRatio = totalVolume > 0 ? ((netFlow / totalVolume) + 1) / 2 : 0.5;
    const whaleActivity = Math.min(whales.length / 20, 1);
    
    const score = (flowRatio * 0.6) + (whaleActivity * 0.4);
    
    return {
      score: Math.min(Math.max(score, 0), 1),
      whales: whales.length,
      uniqueWhales: uniqueBuyers.size,
      netFlow: netFlow.toFixed(2),
      buyVolume: buyVolume.toFixed(2),
      sellVolume: sellVolume.toFixed(2),
      activity: transfers.length > 100 ? 'high' : transfers.length > 50 ? 'medium' : 'low',
      recentWhales: whales.slice(0, 5).map(w => ({
        from: w.from,
        to: w.to,
        value: (parseInt(w.value, 16) / 1e18).toFixed(2),
        hash: w.hash,
      })),
    };
  } catch (e) {
    return { score: 0.3, activity: 'error', error: e.message };
  }
}

// ==========================================
// SCORING ENGINE
// ==========================================

function calculateScore(token, smartMoney) {
  const age = Date.now() - new Date(token.createdAt).getTime();
  const ageHours = age / 3600000;
  
  let ageScore;
  if (ageHours < 1) ageScore = 0.9;
  else if (ageHours < 6) ageScore = 1.0;
  else if (ageHours < 24) ageScore = 0.7;
  else ageScore = 0.4;
  
  const volumeScore = Math.min(token.transfers24h / 100, 1) * 0.3;
  const smartScore = smartMoney.score * 0.4;
  const diversityScore = Math.min(token.uniqueTraders / 100, 1) * 0.2;
  
  const confidence = (ageScore * 0.3) + volumeScore + smartScore + diversityScore;
  
  return {
    confidence: Math.min(confidence, 1),
    ageScore,
    volumeScore,
    smartScore,
    diversityScore,
    recommendation: confidence > 0.8 ? 'STRONG_BUY' :
                   confidence > 0.65 ? 'BUY' :
                   confidence > 0.45 ? 'HOLD' : 'AVOID',
  };
}

// ==========================================
// PORTFOLIO & WALLET
// ==========================================

async function getWalletPortfolio() {
  try {
    const [ethBalance, tokenBalances] = await Promise.all([
      getBalance(CONFIG.WALLET),
      getTokenBalances(CONFIG.WALLET),
    ]);
    
    const tokens = await Promise.all(
      tokenBalances
        .filter(t => t.tokenBalance && t.tokenBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000')
        .slice(0, 20)
        .map(async (t) => {
          try {
            const metadata = await getTokenMetadata(t.contractAddress);
            const balance = parseInt(t.tokenBalance, 16) / Math.pow(10, metadata.decimals || 18);
            return {
              address: t.contractAddress,
              symbol: metadata.symbol || 'UNK',
              name: metadata.name || 'Unknown',
              balance: balance.toFixed(4),
              decimals: metadata.decimals,
              logo: metadata.logo,
            };
          } catch (e) {
            return null;
          }
        })
    );
    
    return {
      nativeETH: ethBalance.toFixed(4),
      tokens: tokens.filter(t => t !== null && parseFloat(t.balance) > 0),
      totalTokens: tokens.filter(t => t !== null).length,
    };
  } catch (e) {
    return { error: e.message };
  }
}

// ==========================================
// TRANSACTION CHECKER
// ==========================================

async function checkTransaction(txHash) {
  try {
    const receipt = await getTransactionReceipt(txHash);
    
    if (!receipt) {
      return { status: 'pending', found: false, confirmations: 0 };
    }
    
    const status = receipt.status === '0x1' ? 'success' : 'failed';
    
    // Save to transactions
    transactions.set(txHash, {
      hash: txHash,
      status,
      checkedAt: Date.now(),
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      from: receipt.from,
      to: receipt.to,
    });
    
    return {
      status,
      found: true,
      blockNumber: parseInt(receipt.blockNumber, 16),
      gasUsed: parseInt(receipt.gasUsed, 16),
      from: receipt.from,
      to: receipt.to,
      contractAddress: receipt.contractAddress,
      confirmations: receipt.confirmations || 0,
    };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

// ==========================================
// HTTP SERVER
// ==========================================

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  // Parse body
  let body = '';
  req.on('data', chunk => body += chunk);
  await new Promise(resolve => req.on('end', resolve));
  const jsonBody = body ? JSON.parse(body) : {};

  // ========== DASHBOARD ==========
  if (path === '/' || path === '/dashboard') {
    res.setHeader('Content-Type', 'text/html');
    return res.end(DASHBOARD_HTML);
  }

  // ========== API: STATS ==========
  if (path === '/api/stats') {
    const openPos = Array.from(positions.values()).filter(p => p.status === 'open').length;
    const uptime = Math.floor((Date.now() - agentStats.startTime) / 3600000);
    const successRate = agentStats.totalTrades > 0 
      ? Math.round((agentStats.successfulTrades / agentStats.totalTrades) * 100) 
      : 0;
    
    return res.end(JSON.stringify({
      ...agentStats,
      openPositions: openPos,
      totalTransactions: transactions.size,
      uptime: uptime + 'h',
      successRate,
    }));
  }

  // ========== API: POSITIONS ==========
  if (path === '/api/positions') {
    const posList = Array.from(positions.values());
    return res.end(JSON.stringify({
      count: posList.length,
      open: posList.filter(p => p.status === 'open').length,
      pending: posList.filter(p => p.status === 'pending').length,
      closed: posList.filter(p => p.status === 'closed').length,
      positions: posList,
    }));
  }

  // ========== API: TRANSACTIONS ==========
  if (path === '/api/transactions') {
    const txList = Array.from(transactions.values()).sort((a, b) => b.checkedAt - a.checkedAt);
    return res.end(JSON.stringify({
      count: txList.length,
      transactions: txList,
    }));
  }

  // ========== API: HISTORY ==========
  if (path === '/api/history') {
    return res.end(JSON.stringify({
      count: tradeHistory.length,
      history: tradeHistory.slice(-100).reverse(),
    }));
  }

  // ========== API: HEALTH ==========
  if (path === '/api/health') {
    return res.end(JSON.stringify({
      status: 'operational',
      agent: 'Alpha Meme',
      version: '1.0.0',
      wallet: CONFIG.WALLET,
      environment: {
        alchemy: CONFIG.ALCHEMY_KEY ? '✅ connected' : '❌ missing',
        bankr: CONFIG.BANKR_API_KEY ? '✅ connected' : '❌ missing',
        basescan: CONFIG.BASESCAN_KEY ? '✅ connected' : '⚪ optional',
      },
      timestamp: new Date().toISOString(),
    }));
  }

  // ========== API: SKILL MANIFEST ==========
  if (path === '/api/skill' || path === '/skill.md') {
    return res.end(JSON.stringify({
      name: 'Alpha Meme',
      description: 'AI agent for autonomous meme coin trading with smart money tracking, dashboard monitoring, and automated execution on Base blockchain',
      version: '1.0.0',
      wallet: CONFIG.WALLET,
      category: 'trading',
      tags: ['meme', 'trading', 'base', 'ai', 'smart-money', 'clanker', 'autonomous', 'dashboard'],
      skills: [
        {
          name: 'scan_opportunities',
          description: 'Scan Clanker tokens with smart money analysis via Alchemy',
          parameters: { limit: { type: 'number', default: 10 }, minConfidence: { type: 'number', default: 0.7 } },
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
          name: 'check_transaction',
          description: 'Verify transaction status on Base blockchain',
          parameters: { txHash: { type: 'string', required: true } },
          pricing: { amount: '0', currency: 'ETH' },
        },
        {
          name: 'get_portfolio',
          description: 'Get wallet portfolio and token balances',
          parameters: {},
          pricing: { amount: '0', currency: 'ETH' },
        },
        {
          name: 'auto_trade',
          description: 'Autonomous scan and execute high-confidence trades',
          parameters: { maxTrades: { type: 'number', default: 2 } },
          pricing: { amount: '0.01', currency: 'ETH' },
        },
      ],
      endpoints: {
        dashboard: '/dashboard',
        health: '/api/health',
        stats: '/api/stats',
        scan: '/api/scan',
        trade: '/api/trade',
        portfolio: '/api/wallet',
        transactions: '/api/transactions',
        history: '/api/history',
      },
      dashboard: '/dashboard',
    }, null, 2));
  }

  // ========== API: SCAN ==========
  if (path === '/api/scan') {
    try {
      agentStats.totalScans++;
      const tokens = await scanClankerTokens();
      
      const analyzed = await Promise.all(
        tokens.map(async (t) => {
          const smart = await analyzeSmartMoney(t.address);
          const scores = calculateScore(t, smart);
          return {
            ...t,
            smartMoney: smart,
            ...scores,
          };
        })
      );
      
      const sorted = analyzed.sort((a, b) => b.confidence - a.confidence);
      
      return res.end(JSON.stringify({
        success: true,
        scanned: tokens.length,
        analyzed: analyzed.length,
        opportunities: sorted.filter(a => a.confidence >= CONFIG.MIN_CONFIDENCE),
        allTokens: sorted.map(a => ({
          address: a.address,
          symbol: a.symbol,
          confidence: a.confidence,
          recommendation: a.recommendation,
        })),
        timestamp: new Date().toISOString(),
      }));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  // ========== API: TRADE ==========
  if (path === '/api/trade' && req.method === 'POST') {
    const { token, action, amount } = jsonBody;
    
    if (!token || !action) {
      res.writeHead(400);
      return res.end(JSON.stringify({ success: false, error: 'Missing required fields: token, action' }));
    }
    
    if (!['buy', 'sell'].includes(action)) {
      res.writeHead(400);
      return res.end(JSON.stringify({ success: false, error: 'Action must be buy or sell' }));
    }

    try {
      const result = await bankrTrade(token, action, amount);
      
      if (result.jobId) {
        const tokenData = await getTokenMetadata(token);
        const position = {
          token,
          symbol: tokenData.symbol || 'Unknown',
          decimals: tokenData.decimals || 18,
          action,
          amount: amount || CONFIG.MAX_TRADE_SIZE,
          entry: Date.now(),
          entryPrice: 0,
          jobId: result.jobId,
          status: 'pending',
        };
        
        positions.set(token, position);
        
        tradeHistory.push({
          time: Date.now(),
          token,
          symbol: tokenData.symbol || 'Unknown',
          action,
          amount: amount || CONFIG.MAX_TRADE_SIZE,
          status: 'pending',
          jobId: result.jobId,
        });
        
        // Poll for completion
        setTimeout(async () => {
          try {
            const status = await checkBankrJob(result.jobId);
            if (status.status === 'completed') {
              position.status = 'open';
              position.txHash = status.txHash;
              agentStats.successfulTrades++;
              
              // Update history
              const historyItem = tradeHistory.find(h => h.jobId === result.jobId);
              if (historyItem) historyItem.status = 'success';
            } else if (status.status === 'failed') {
              position.status = 'failed';
              agentStats.failedTrades++;
              
              const historyItem = tradeHistory.find(h => h.jobId === result.jobId);
              if (historyItem) historyItem.status = 'failed';
            }
          } catch (err) {
            console.error('Polling error:', err);
          }
        }, 5000);
      }

      return res.end(JSON.stringify({
        success: true,
        message: `${action} order submitted`,
        token,
        amount: amount || CONFIG.MAX_TRADE_SIZE,
        jobId: result.jobId,
        status: result.status,
        checkStatus: `/api/job/${result.jobId}`,
      }));
    } catch (e) {
      agentStats.failedTrades++;
      res.writeHead(500);
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  // ========== API: CHECK JOB ==========
  if (path.startsWith('/api/job/')) {
    const jobId = path.split('/')[3];
    if (!jobId) {
      res.writeHead(400);
      return res.end(JSON.stringify({ success: false, error: 'Missing job ID' }));
    }

    try {
      const status = await checkBankrJob(jobId);
      return res.end(JSON.stringify({ success: true, ...status }));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  // ========== API: CHECK TRANSACTION ==========
  if (path === '/api/tx' && req.method === 'POST') {
    const { txHash } = jsonBody;
    if (!txHash) {
      res.writeHead(400);
      return res.end(JSON.stringify({ success: false, error: 'Missing txHash' }));
    }

    try {
      const result = await checkTransaction(txHash);
      return res.end(JSON.stringify({
        success: true,
        txHash,
        ...result,
        explorer: {
          basescan: `https://basescan.org/tx/${txHash}`,
          blockscout: `https://base.blockscout.com/tx/${txHash}`,
        },
      }));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  if (path.startsWith('/api/tx/')) {
    const txHash = path.split('/')[3];
    if (!txHash || txHash.length !== 66) {
      res.writeHead(400);
      return res.end(JSON.stringify({ success: false, error: 'Invalid txHash format' }));
    }

    try {
      const result = await checkTransaction(txHash);
      return res.end(JSON.stringify({ success: true, txHash, ...result }));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  // ========== API: WALLET / PORTFOLIO ==========
  if (path === '/api/wallet') {
    try {
      const portfolio = await getWalletPortfolio();
      const recentTx = await getAssetTransfers(null, '0x' + (await getLatestBlock() - 1000).toString(16));
      
      return res.end(JSON.stringify({
        success: true,
        wallet: CONFIG.WALLET,
        ...portfolio,
        recentTransfers: recentTx.slice(0, 10).map(t => ({
          hash: t.hash,
          from: t.from,
          to: t.to,
          value: t.value,
          asset: t.asset,
          category: t.category,
        })),
        links: {
          basescan: `https://basescan.org/address/${CONFIG.WALLET}`,
          blockscout: `https://base.blockscout.com/address/${CONFIG.WALLET}`,
        },
      }));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  // ========== API: AUTO TRADE ==========
  if (path === '/api/auto') {
    try {
      agentStats.totalScans++;
      const tokens = await scanClankerTokens();
      
      const analyzed = await Promise.all(
        tokens.slice(0, 8).map(async (t) => {
          const smart = await analyzeSmartMoney(t.address);
          return { ...t, ...calculateScore(t, smart), smart };
        })
      );

      const highConfidence = analyzed.filter(a => a.confidence > 0.8);
      const results = [];

      for (const token of highConfidence.slice(0, 2)) {
        try {
          const trade = await bankrTrade(token.address, 'buy', CONFIG.MAX_TRADE_SIZE);
          results.push({
            symbol: token.symbol,
            address: token.address,
            confidence: token.confidence,
            jobId: trade.jobId,
            status: 'submitted',
          });

          positions.set(token.address, {
            token: token.address,
            symbol: token.symbol,
            action: 'buy',
            amount: CONFIG.MAX_TRADE_SIZE,
            entry: Date.now(),
            jobId: trade.jobId,
            status: 'pending',
            confidence: token.confidence,
          });

          tradeHistory.push({
            time: Date.now(),
            token: token.address,
            symbol: token.symbol,
            action: 'buy',
            amount: CONFIG.MAX_TRADE_SIZE,
            status: 'pending',
            jobId: trade.jobId,
          });
        } catch (err) {
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
        executed: results.filter(r => r.jobId).length,
        results,
        timestamp: new Date().toISOString(),
      }));
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  // ========== 404 NOT FOUND ==========
  res.writeHead(404);
  res.end(JSON.stringify({
    success: false,
    error: 'Not found',
    message: 'Endpoint not found',
    available: {
      dashboard: '/dashboard',
      api: [
        'GET /api/health',
        'GET /api/stats',
        'GET /api/positions',
        'GET /api/transactions',
        'GET /api/history',
        'GET /api/skill',
        'GET /api/scan',
        'POST /api/trade',
        'GET /api/job/:id',
        'POST /api/tx',
        'GET /api/tx/:hash',
        'GET /api/wallet',
        'GET /api/auto',
      ],
    },
  }));
});

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║         🚀 ALPHA MEME AI AGENT v1.0.0                  ║
╠════════════════════════════════════════════════════════╣
  💰 Wallet: ${CONFIG.WALLET}
  🔮 Alchemy: ${CONFIG.ALCHEMY_KEY ? '✅ Connected' : '❌ Missing'}
  🏦 Bankr: ${CONFIG.BANKR_API_KEY ? '✅ Connected' : '❌ Missing'}
  📊 Basescan: ${CONFIG.BASESCAN_KEY ? '✅ Connected' : '⚪ Optional'}
  🌐 Port: ${PORT}
╠════════════════════════════════════════════════════════╣
  📊 Dashboard:  http://localhost:${PORT}/dashboard
  🏥 Health:      http://localhost:${PORT}/api/health
  📖 API:         http://localhost:${PORT}/api/scan
╚════════════════════════════════════════════════════════╝
  `);
});
