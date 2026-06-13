#!/bin/bash
set -e

# Directories
BASE_DIR="/home/humchandan/.gemini/antigravity/scratch/genesis-blockchain/blockchain"
DATA_DIR="$BASE_DIR/data"
mkdir -p "$DATA_DIR/node1" "$DATA_DIR/node2"

echo "123456" > "$DATA_DIR/password.txt"

# Generate JWT secret if not exists
if [ ! -f "$DATA_DIR/jwt.hex" ]; then
    echo "Generating JWT secret..."
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" > "$DATA_DIR/jwt.hex"
fi

# Private keys (without 0x prefix)
# 0x963EBDf2e1f8DB8707D05FC75bfeFFBa1B5BaC17
echo "741de4f8988ea941d3ff0287911ca4074e62b7d45c991a51186455366f10b544" > "$DATA_DIR/key1.txt"
# 0x40a0cb1C63e026A81B55EE1308586E21eec1eFa9
echo "3b7955d25189c99a7468192fcbc6429205c158834053ebe3f78f4512ab432db9" > "$DATA_DIR/key2.txt"

echo "Importing validator keys..."
geth --datadir "$DATA_DIR/node1" account import --password "$DATA_DIR/password.txt" "$DATA_DIR/key1.txt" || true
geth --datadir "$DATA_DIR/node2" account import --password "$DATA_DIR/password.txt" "$DATA_DIR/key2.txt" || true

echo "Initializing genesis..."
# Force clean state or re-init
geth --datadir "$DATA_DIR/node1" init "$BASE_DIR/genesis.json" || true
geth --datadir "$DATA_DIR/node2" init "$BASE_DIR/genesis.json" || true

# Kill any existing geth processes to avoid port conflicts
killall geth || true
sleep 1

echo "Starting Node 1..."
geth --datadir "$DATA_DIR/node1" \
     --networkid 232425 \
     --port 30303 \
     --http \
     --http.addr 0.0.0.0 \
     --http.port 8545 \
     --http.corsdomain "*" \
     --http.vhosts "*" \
     --http.api eth,net,web3,personal,clique,admin,engine,txpool,debug \
     --ws \
     --ws.addr 0.0.0.0 \
     --ws.port 8545 \
     --ws.origins "*" \
     --ws.api eth,net,web3,personal,clique,admin,engine,txpool,debug \
     --authrpc.addr 127.0.0.1 \
     --authrpc.port 8551 \
     --authrpc.vhosts "*" \
     --authrpc.jwtsecret "$DATA_DIR/jwt.hex" \
     --unlock 0x963EBDf2e1f8DB8707D05FC75bfeFFBa1B5BaC17 \
     --password "$DATA_DIR/password.txt" \
     --allow-insecure-unlock \
     --nodiscover \
     --mine \
     --miner.etherbase 0x963EBDf2e1f8DB8707D05FC75bfeFFBa1B5BaC17 \
     --syncmode full \
     > "$DATA_DIR/node1.log" 2>&1 &

sleep 2

# Retrieve enode address of Node 1 and strip discovery parameters
echo "Retrieving Node 1 enode address..."
ENODE=$(geth --datadir "$DATA_DIR/node1" attach --exec "admin.nodeInfo.enode" | tr -d '"' | cut -d'?' -f1)
# Force enode IP to 127.0.0.1 for local connection
ENODE_IP=$(echo "$ENODE" | sed 's/@[0-9\.]*:/@127.0.0.1:/')
echo "Node 1 Enode: $ENODE_IP"

echo "Starting Node 2..."
geth --datadir "$DATA_DIR/node2" \
     --networkid 232425 \
     --port 30304 \
     --http \
     --http.addr 127.0.0.1 \
     --http.port 8546 \
     --http.corsdomain "*" \
     --http.api eth,net,web3,personal,clique,admin,engine,txpool,debug \
     --authrpc.addr 127.0.0.1 \
     --authrpc.port 8552 \
     --authrpc.vhosts "*" \
     --authrpc.jwtsecret "$DATA_DIR/jwt.hex" \
     --unlock 0x40a0cb1C63e026A81B55EE1308586E21eec1eFa9 \
     --password "$DATA_DIR/password.txt" \
     --allow-insecure-unlock \
     --nodiscover \
     --mine \
     --miner.etherbase 0x40a0cb1C63e026A81B55EE1308586E21eec1eFa9 \
     --syncmode full \
     > "$DATA_DIR/node2.log" 2>&1 &

sleep 3

echo "Manually linking Node 2 to Node 1..."
geth --datadir "$DATA_DIR/node2" attach --exec "admin.addPeer('$ENODE_IP')"

echo "Nodes started successfully!"
echo "Node 1 HTTP RPC: http://127.0.0.1:8545"
echo "Node 2 HTTP RPC: http://127.0.0.1:8546"

# Wait for both nodes (keeps the script running)
wait
