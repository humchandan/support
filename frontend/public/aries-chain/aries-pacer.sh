#!/bin/bash

# ==============================================================================
# Aries Consensus Pacer
# ==============================================================================
# Dynamically adjusts timeout_commit based on mempool and block activity.
# Wakes up instantly (500ms blocks) when transactions are submitted.
# Decays blocks sequentially to 5s, 10s, and up to 15m when idle.
# ==============================================================================

CHAINDIR="$HOME/.ariesd"
CONFIG_TOML="$CHAINDIR/config/config.toml"
PID_FILE="$CHAINDIR/ariesd.pid"

# Consensus block timeouts
ACTIVE_TIMEOUT="500ms"
STAGE_1_TIMEOUT="5s"
STAGE_2_TIMEOUT="10s"
STAGE_3_TIMEOUT="15m"

# State variables
current_timeout=""
empty_block_count=0
last_seen_height=0

# Read current timeout from config on startup
if [ -f "$CONFIG_TOML" ]; then
  current_timeout=$(grep -E "^timeout_commit =" "$CONFIG_TOML" | head -n 1 | cut -d'"' -f2)
fi
if [ -z "$current_timeout" ]; then
  current_timeout=$ACTIVE_TIMEOUT
fi

echo "🤖 Aries Consensus Pacer started (Initial Timeout: $current_timeout)..."

update_timeout() {
  local new_timeout="$1"
  if [ "$current_timeout" != "$new_timeout" ]; then
    echo "🔄 Adjusting block commit timeout from $current_timeout to $new_timeout"
    
    # Modify config.toml
    sed -i.bak "s/^timeout_commit = \".*\"/timeout_commit = \"$new_timeout\"/g" "$CONFIG_TOML"
    rm -f "$CHAINDIR/config/*.bak"
    current_timeout="$new_timeout"
    
    # Signal ariesd to restart
    if [ -f "$PID_FILE" ]; then
      local pid=$(cat "$PID_FILE")
      if kill -0 "$pid" 2>/dev/null; then
        echo "☠️  Signaling ariesd (PID $pid) to reload configuration..."
        kill -15 "$pid"
      fi
    else
      echo "⚠️  ariesd.pid file not found. Daemon restart skipped."
    fi
  fi
}

while true; do
  # 1. Poll the mempool for pending transactions
  mempool_status=$(curl -s --max-time 1 http://127.0.0.1:26657/num_unconfirmed_txs)
  if [ $? -eq 0 ]; then
    mempool_txs=$(echo "$mempool_status" | jq -r '.result.n_txs // "0"')
    
    # If there are transactions in the mempool, instantly trigger active mode
    if [ "$mempool_txs" -gt 0 ]; then
      if [ "$current_timeout" != "$ACTIVE_TIMEOUT" ]; then
        echo "🔥 Mempool transaction detected ($mempool_txs pending)! Triggering instant wake-up..."
        empty_block_count=0
        update_timeout "$ACTIVE_TIMEOUT"
        # Sleep for a bit to allow the node to boot and consume the transaction
        sleep 1.5
      fi
      sleep 0.1
      continue
    fi
  fi

  # 2. Check the latest committed block height
  block_status=$(curl -s --max-time 1 http://127.0.0.1:26657/block)
  if [ $? -eq 0 ]; then
    latest_height=$(echo "$block_status" | jq -r '.result.block.header.height // "0"')
    
    if [ "$latest_height" -gt "$last_seen_height" ] && [ "$last_seen_height" -gt 0 ]; then
      # A new block was committed
      tx_count=$(echo "$block_status" | jq 'if .result.block.data.txs == null then 0 else .result.block.data.txs | length end')
      
      if [ "$tx_count" -eq 0 ]; then
        ((empty_block_count++))
        echo "ℹ️  Block $latest_height committed with 0 txs. Empty blocks count: $empty_block_count"
        
        # Pacing transitions:
        # After 3 empty blocks, transition to 5s
        if [ "$empty_block_count" -eq 3 ]; then
          update_timeout "$STAGE_1_TIMEOUT"
        # After 6 empty blocks (3 at 5s), transition to 10s
        elif [ "$empty_block_count" -eq 6 ]; then
          update_timeout "$STAGE_2_TIMEOUT"
        # After 9 empty blocks (3 at 10s), transition to 15m
        elif [ "$empty_block_count" -gt 8 ]; then
          update_timeout "$STAGE_3_TIMEOUT"
        fi
      else
        # Block has transactions, reset count and set active timeout
        echo "🎉 Block $latest_height committed with $tx_count transactions!"
        empty_block_count=0
        update_timeout "$ACTIVE_TIMEOUT"
      fi
      
      last_seen_height="$latest_height"
    elif [ "$last_seen_height" -eq 0 ]; then
      last_seen_height="$latest_height"
    fi
  fi

  sleep 0.5
done
