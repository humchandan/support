#!/bin/bash
BASE_DIR="/home/humchandan/.gemini/antigravity/scratch/genesis-blockchain/blockchain"

# Ensure log directory exists
mkdir -p "$BASE_DIR/data"

# Kill any existing processes
echo "Stopping any running Geth or Node.js consensus processes..."
killall geth 2>/dev/null || true
pkill -f "node consensus_client.js" 2>/dev/null || true
sleep 1

# Start Geth nodes in the background
echo "Starting Geth nodes via node_setup.sh..."
cd "$BASE_DIR"
./node_setup.sh &
SETUP_PID=$!

# Wait for Node 1 RPC (8545) to be online
echo "Waiting for Geth Node 1 RPC to start on port 8545..."
for i in {1..30}; do
    if curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://127.0.0.1:8545 > /dev/null; then
        echo "Geth Node 1 RPC is online!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "Error: Geth node failed to start in 30 seconds."
        exit 1
    fi
    sleep 1
done

echo "Starting Aries consensus client..."
node consensus_client.js > "$BASE_DIR/data/consensus_client.log" 2>&1 &
CONSENSUS_PID=$!

echo "Ecosystem started successfully!"
echo "Geth setup PID: $SETUP_PID"
echo "Consensus Client PID: $CONSENSUS_PID"
echo "Consensus logs are flowing to: $BASE_DIR/data/consensus_client.log"

# Clean shutdown function
cleanup() {
    echo "Shutting down network..."
    kill $CONSENSUS_PID 2>/dev/null || true
    kill $SETUP_PID 2>/dev/null || true
    killall geth 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for both background processes
wait $SETUP_PID $CONSENSUS_PID
