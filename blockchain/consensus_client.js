const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

// Load JWT Secret
const BASE_DIR = __dirname;
const JWT_PATH = path.join(BASE_DIR, 'data', 'jwt.hex');

if (!fs.existsSync(JWT_PATH)) {
  console.error(`Error: jwt.hex not found at ${JWT_PATH}. Please start the nodes first using node_setup.sh.`);
  process.exit(1);
}

const jwtSecret = fs.readFileSync(JWT_PATH, 'utf8').trim();
console.log(`Loaded JWT Secret (first 8 chars): ${jwtSecret.substring(0, 8)}...`);

// Helper to base64url-encode buffers
function base64url(buf) {
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Generate JWT token for Engine API authentication
function generateJwt() {
  const secret = Buffer.from(jwtSecret, 'hex');
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  const payload = {
    iat: Math.floor(Date.now() / 1000)
  };
  
  const headerB64 = base64url(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)));
  
  const signature = crypto.createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const signatureB64 = base64url(signature);
  
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

// HTTP POST JSON RPC Helper
function postJson(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse response JSON: ${data}`));
          }
        } else {
          reject(new Error(`HTTP error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(JSON.stringify(body));
    req.end();
  });
}

// Engine API request helper with JWT auth
async function engineCall(url, method, params = []) {
  const token = generateJwt();
  const headers = {
    'Authorization': `Bearer ${token}`
  };
  const body = {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params
  };
  
  const res = await postJson(url, headers, body);
  if (res.error) {
    throw new Error(`Engine API error: ${JSON.stringify(res.error)}`);
  }
  return res.result;
}

// Standard JSON-RPC call helper (no auth)
async function rpcCall(url, method, params = []) {
  const body = {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params
  };
  const res = await postJson(url, {}, body);
  if (res.error) {
    throw new Error(`RPC error: ${JSON.stringify(res.error)}`);
  }
  return res.result;
}

// Node configuration
const nodes = [
  {
    name: 'Node 1',
    rpc: 'http://127.0.0.1:8545',
    engine: 'http://127.0.0.1:8551',
    feeRecipient: '0x963EBDf2e1f8DB8707D05FC75bfeFFBa1B5BaC17'
  },
  {
    name: 'Node 2',
    rpc: 'http://127.0.0.1:8546',
    engine: 'http://127.0.0.1:8552',
    feeRecipient: '0x40a0cb1C63e026A81B55EE1308586E21eec1eFa9'
  }
];

let slotCount = 0;

async function runSlot() {
  slotCount++;
  console.log(`\n--- Slot ${slotCount} ---`);
  
  // Alternate block proposer between Node 1 and Node 2
  const proposerIndex = slotCount % nodes.length;
  const proposer = nodes[proposerIndex];
  console.log(`Block Proposer: ${proposer.name}`);

  try {
    // 1. Get latest block info from proposer
    const latestBlock = await rpcCall(proposer.rpc, 'eth_getBlockByNumber', ['latest', false]);
    if (!latestBlock) {
      console.log(`[Warning] Node ${proposer.name} is not responding or not initialized yet.`);
      return;
    }
    
    const headBlockHash = latestBlock.hash;
    const blockNumberHex = latestBlock.number;
    const parentTimestamp = parseInt(latestBlock.timestamp, 16);
    const blockNumber = parseInt(blockNumberHex, 16);
    
    console.log(`Latest block: #${blockNumber} (hash: ${headBlockHash.substring(0, 10)}...)`);

    // Calculate next block timestamp (must be strictly greater than parent)
    const nowSecs = Math.floor(Date.now() / 1000);
    const nextTimestamp = Math.max(nowSecs, parentTimestamp + 1);
    const nextTimestampHex = '0x' + nextTimestamp.toString(16);

    // 2. Start block production (Forkchoice Update with payload attributes)
    const forkchoiceState = {
      headBlockHash,
      safeBlockHash: headBlockHash,
      finalizedBlockHash: headBlockHash
    };
    
    const payloadAttributes = {
      timestamp: nextTimestampHex,
      prevRandao: '0x0000000000000000000000000000000000000000000000000000000000000000',
      suggestedFeeRecipient: proposer.feeRecipient
    };

    console.log(`Initiating payload build on ${proposer.name}...`);
    const fcuResult = await engineCall(proposer.engine, 'engine_forkchoiceUpdatedV1', [forkchoiceState, payloadAttributes]);
    
    if (fcuResult.payloadStatus.status !== 'VALID') {
      console.error(`[Error] ForkchoiceUpdate returned status: ${fcuResult.payloadStatus.status}`);
      return;
    }
    
    const payloadId = fcuResult.payloadId;
    if (!payloadId) {
      console.error(`[Error] ForkchoiceUpdate did not return a payloadId.`);
      return;
    }
    console.log(`Payload build initiated. ID: ${payloadId}`);

    // Wait a brief period for transactions to bundle
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Retrieve the compiled execution payload
    console.log(`Retrieving execution payload...`);
    const executionPayload = await engineCall(proposer.engine, 'engine_getPayloadV1', [payloadId]);
    console.log(`Payload retrieved. Block Hash: ${executionPayload.blockHash.substring(0, 10)}... (Transactions: ${executionPayload.transactions.length})`);

    // 4. Submit the execution payload to ALL execution nodes
    for (const node of nodes) {
      try {
        console.log(`Submitting payload to ${node.name}...`);
        const statusResult = await engineCall(node.engine, 'engine_newPayloadV1', [executionPayload]);
        console.log(`${node.name} status: ${statusResult.status}`);
        if (statusResult.status !== 'VALID' && statusResult.status !== 'ACCEPTED') {
          console.error(`[Error] Node ${node.name} rejected payload: ${JSON.stringify(statusResult)}`);
        }
      } catch (err) {
        console.error(`[Error] Failed to submit payload to ${node.name}: ${err.message}`);
      }
    }

    // 5. Update the forkchoice on ALL execution nodes to head of the new block
    const newForkchoiceState = {
      headBlockHash: executionPayload.blockHash,
      safeBlockHash: executionPayload.blockHash,
      finalizedBlockHash: executionPayload.blockHash
    };

    for (const node of nodes) {
      try {
        console.log(`Updating forkchoice on ${node.name}...`);
        const fcuResultNew = await engineCall(node.engine, 'engine_forkchoiceUpdatedV1', [newForkchoiceState, null]);
        console.log(`${node.name} FCU status: ${fcuResultNew.payloadStatus.status}`);
      } catch (err) {
        console.error(`[Error] Failed to update forkchoice on ${node.name}: ${err.message}`);
      }
    }
    
    console.log(`Block #${blockNumber + 1} finalized successfully!`);

  } catch (err) {
    console.error(`Error in slot execution:`, err);
  }
}

// Main execution loop
async function main() {
  console.log('Aries Consensus Client started.');
  console.log('Driving nodes:');
  nodes.forEach(n => console.log(` - ${n.name}: HTTP:${n.rpc} Engine:${n.engine}`));
  
  console.log('\nInitializing forkchoice on all nodes to latest block...');
  try {
    const latestBlock = await rpcCall(nodes[0].rpc, 'eth_getBlockByNumber', ['latest', false]);
    if (latestBlock) {
      const latestHash = latestBlock.hash;
      const latestNumber = parseInt(latestBlock.number, 16);
      console.log(`Latest block number: ${latestNumber} (hash: ${latestHash})`);
      
      const forkchoiceState = {
        headBlockHash: latestHash,
        safeBlockHash: latestHash,
        finalizedBlockHash: latestHash
      };
      
      for (const node of nodes) {
        try {
          console.log(`Initializing forkchoice on ${node.name}...`);
          const fcuResult = await engineCall(node.engine, 'engine_forkchoiceUpdatedV1', [forkchoiceState, null]);
          console.log(`${node.name} initialization FCU status: ${fcuResult.payloadStatus.status}`);
        } catch (err) {
          console.error(`[Error] Failed to initialize forkchoice on ${node.name}: ${err.message}`);
        }
      }
    } else {
      console.error('Error: Could not retrieve latest block.');
    }
  } catch (err) {
    console.error('Error during initialization:', err.message);
  }
  
  // Run slot immediately, then every 3 seconds
  await runSlot();
  setInterval(runSlot, 3000);
}

main().catch(console.error);
