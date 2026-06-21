#!/bin/bash

# ==============================================================================
# The Aries Project (ARES) Local Devnet Bootstrap Script
# ==============================================================================
# Sets up a single-node Aries local devnet with customized branding, ARES denoms,
# 60,000 ARES validator staking limits, and low-latency block timeouts.
# ==============================================================================
# Export Go bin directories to PATH to ensure compiled binaries are accessible
export PATH=$PATH:$HOME/go/bin:$(go env GOPATH 2>/dev/null)/bin:/usr/local/go/bin

CHAINID="${CHAIN_ID:-232425}"
MONIKER="aries-dev-node"
KEYRING="test"
KEYALGO="eth_secp256k1"
LOGLEVEL="info"

# Home directory for the custom ariesd node daemon
CHAINDIR="$HOME/.ariesd"
BASEFEE=1000000000

# Path configurations
CONFIG_TOML=$CHAINDIR/config/config.toml
APP_TOML=$CHAINDIR/config/app.toml
GENESIS=$CHAINDIR/config/genesis.json
TMP_GENESIS=$CHAINDIR/config/tmp_genesis.json

# Validate dependencies
command -v jq >/dev/null 2>&1 || {
  echo >&2 "jq is required but not installed. Installing jq is necessary to build genesis."
  exit 1
}

set -e

# Flags configuration
install=true
overwrite=""
BUILD_FOR_DEBUG=false
ADDITIONAL_USERS=0
MNEMONIC_FILE=""
MNEMONICS_INPUT=""
ARCHIVE_MODE=false

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  -y                       Overwrite existing chain data without prompting
  -n                       Do not overwrite existing chain data
  --no-install             Skip compiling and installing the ariesd binary
  --remote-debugging       Build with no-optimization/no-strip parameters
  --additional-users N     Create N extra prefunded developer keys
  --archive                Run node in full archive mode (no pruning)
EOF
}

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -y)
      overwrite="y"; shift
      ;;
    -n)
      overwrite="n"; shift
      ;;
    --no-install)
      install=false; shift
      ;;
    --remote-debugging)
      BUILD_FOR_DEBUG=true; shift
      ;;
    --additional-users)
      ADDITIONAL_USERS="$2"; shift 2
      ;;
    --archive)
      ARCHIVE_MODE=true; shift
      ;;
    -h|--help)
      usage; exit 0
      ;;
    *)
      echo "Unknown flag: $key"; usage; exit 1
      ;;
  esac
done

# Compile the ariesd binary using the renamed target in our Makefile
if [[ $install == true ]]; then
  echo "🏗️  Compiling and installing ariesd L1 daemon..."
  if [[ $BUILD_FOR_DEBUG == true ]]; then
    make install COSMOS_BUILD_OPTIONS=nooptimization,nostrip
  else
    make install
  fi
fi

if [[ $overwrite = "" ]]; then
  if [ -d "$CHAINDIR" ]; then
    printf "\nAn existing configuration folder at '%s' was found. \n" "$CHAINDIR"
    echo "Overwrite the existing configuration and bootstrap a new devnet? [y/n]"
    read -r overwrite
  else
    overwrite="y"
  fi
fi

add_genesis_funds() {
  local keyname="$1"
  # Prefund developer wallets with 1,000,000 ARES (18 decimals -> 10^24 aares)
  ariesd genesis add-genesis-account "$keyname" 1000000000000000000000000aares --keyring-backend "$KEYRING" --home "$CHAINDIR"
}

if [[ $overwrite == "y" || $overwrite == "Y" ]]; then
  echo "🧹 Cleaning previous node configurations..."
  rm -rf "$CHAINDIR"

  ariesd config set client chain-id "$CHAINID" --home "$CHAINDIR"
  ariesd config set client keyring-backend "$KEYRING" --home "$CHAINDIR"

  # Initialize chain genesis (No recover, clean start)
  ariesd init "$MONIKER" -o --chain-id "$CHAINID" --home "$CHAINDIR"

  # ---------------- Validator key (Generated Dynamically for Security) ----------------
  VAL_KEY="validator-key"
  echo "🔑 Generating dynamic validator keypair..."
  ariesd keys add "$VAL_KEY" --keyring-backend "$KEYRING" --algo "$KEYALGO" --home "$CHAINDIR"
  VAL_ADDR=$(ariesd keys show "$VAL_KEY" -a --keyring-backend "$KEYRING" --home "$CHAINDIR")
  echo "Validator Key Address: $VAL_ADDR"

  # ---------------- Genesis Customizations (Rebranding to ARES & Low-Latency Tuning) ----------------
  echo "⚙️  Refactoring genesis module states for gold ARES..."
  
  # Update default staking, governance, and minting denominations to standard 18-decimal aares (atto-ARES)
  jq '.app_state["staking"]["params"]["bond_denom"]="aares"' "$GENESIS" >"$TMP_GENESIS" && mv "$TMP_GENESIS" "$GENESIS"
  jq '.app_state["gov"]["deposit_params"]["min_deposit"][0]["denom"]="aares"' "$GENESIS" >"$TMP_GENESIS" && mv "$TMP_GENESIS" "$GENESIS"
  jq '.app_state["gov"]["params"]["min_deposit"][0]["denom"]="aares"' "$GENESIS" >"$TMP_GENESIS" && mv "$TMP_GENESIS" "$GENESIS"
  jq '.app_state["gov"]["params"]["expedited_min_deposit"][0]["denom"]="aares"' "$GENESIS" >"$TMP_GENESIS" && mv "$TMP_GENESIS" "$GENESIS"
  jq '.app_state["evm"]["params"]["evm_denom"]="aares"' "$GENESIS" >"$TMP_GENESIS" && mv "$TMP_GENESIS" "$GENESIS"
  jq '.app_state["mint"]["params"]["mint_denom"]="aares"' "$GENESIS" >"$TMP_GENESIS" && mv "$TMP_GENESIS" "$GENESIS"

  # Configure Inflation parameters: 7% initial/minimum inflation, up to 18% maximum inflation limit
  jq '.app_state["mint"]["minter"]["inflation"]="0.070000000000000000"' "$GENESIS" >"$TMP_GENESIS" && mv "$TMP_GENESIS" "$GENESIS"
  jq '.app_state["mint"]["params"]["inflation_min"]="0.070000000000000000"' "$GENESIS" >"$TMP_GENESIS" && mv "$TMP_GENESIS" "$GENESIS"
  jq '.app_state["mint"]["params"]["inflation_max"]="0.180000000000000000"' "$GENESIS" >"$TMP_GENESIS" && mv "$TMP_GENESIS" "$GENESIS"

  # Configure feemarket params for EIP-1559 Mainnet
  jq '.app_state["feemarket"]["params"]["no_base_fee"]=false' "$GENESIS" >"$TMP_GENESIS" && mv "$TMP_GENESIS" "$GENESIS"
  jq '.app_state["feemarket"]["params"]["base_fee"]="1000000000"' "$GENESIS" >"$TMP_GENESIS" && mv "$TMP_GENESIS" "$GENESIS"
  jq '.app_state["feemarket"]["params"]["min_gas_price"]="1000000000.000000000000000000"' "$GENESIS" >"$TMP_GENESIS" && mv "$TMP_GENESIS" "$GENESIS"
  jq '.app_state["feemarket"]["params"]["base_fee_change_denominator"]=8' "$GENESIS" >"$TMP_GENESIS" && mv "$TMP_GENESIS" "$GENESIS"

  # Update bank metadata to show ARES
  jq '.app_state["bank"]["denom_metadata"]=[{"description":"The native utility and staking coin for the custom Aries L1 blockchain.","denom_units":[{"denom":"aares","exponent":0,"aliases":["atto-ARES"]},{"denom":"ares","exponent":18,"aliases":[]}],"base":"aares","display":"ares","name":"Ares Coin","symbol":"ARES","uri":"","uri_hash":""}]' "$GENESIS" >"$TMP_GENESIS" && mv "$TMP_GENESIS" "$GENESIS"

  # Configure active EVM modules and ERC20 integration defaults
  jq '.app_state["evm"]["params"]["active_static_precompiles"]=["0x0000000000000000000000000000000000000100","0x0000000000000000000000000000000000000400","0x0000000000000000000000000000000000000800","0x0000000000000000000000000000000000000801","0x0000000000000000000000000000000000000802","0x0000000000000000000000000000000000000803","0x0000000000000000000000000000000000000804","0x0000000000000000000000000000000000000805", "0x0000000000000000000000000000000000000806", "0x0000000000000000000000000000000000000807"]' "$GENESIS" >"$TMP_GENESIS" && mv "$TMP_GENESIS" "$GENESIS"
  jq '.app_state.erc20.native_precompiles=["0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"]' "$GENESIS" >"$TMP_GENESIS" && mv "$TMP_GENESIS" "$GENESIS"
  jq '.app_state.erc20.token_pairs=[{contract_owner:1,erc20_address:"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",denom:"aares",enabled:true}]' "$GENESIS" >"$TMP_GENESIS" && mv "$TMP_GENESIS" "$GENESIS"

  # Enforce gas limits and quick voting/deposit periods for easy local sandbox checks
  jq '.consensus.params.block.max_gas="15000000"' "$GENESIS" >"$TMP_GENESIS" && mv "$TMP_GENESIS" "$GENESIS"
  sed -i.bak 's/"max_deposit_period": "172800s"/"max_deposit_period": "30s"/g' "$GENESIS"
  sed -i.bak 's/"voting_period": "172800s"/"voting_period": "30s"/g' "$GENESIS"
  sed -i.bak 's/"expedited_voting_period": "86400s"/"expedited_voting_period": "15s"/g' "$GENESIS"

  # Fund the validator key with 61,000 ARES (6.1 * 10^22 aares) in genesis (providing gas fee buffer)
  echo "💰 Funding validator account with 61,000 ARES..."
  ariesd genesis add-genesis-account "$VAL_ADDR" 61000000000000000000000aares --home "$CHAINDIR"

  # Fund the main public wallet with 2.1 Billion ARES (2.1 * 10^27 aares) in genesis
  echo "💰 Funding main public distribution wallet (0x0d85062FB39139A2601C87B376C883a1e2Db8D20 -> aries1pkzsvtanjyu6ycqus7ehdjyr583dhrfq5u4r7j) with 2.1 Billion ARES..."
  ariesd genesis add-genesis-account aries1pkzsvtanjyu6ycqus7ehdjyr583dhrfq5u4r7j 2100000000000000000000000000aares --home "$CHAINDIR"

  # ---------------- Create GenTx satisfying the 60,000 ARES Validator Staking limit ----------------
  echo "🗳️  Creating Genesis delegation transaction of 60,000 ARES..."
  ariesd genesis gentx "$VAL_KEY" 60000000000000000000000aares --gas-prices ${BASEFEE}aares --keyring-backend "$KEYRING" --chain-id "$CHAINID" --home "$CHAINDIR"
  ariesd genesis collect-gentxs --home "$CHAINDIR"
  ariesd genesis validate-genesis --home "$CHAINDIR"

  # ---------------- Low-Latency Consensus Parameter Tuning (Config.toml & App.toml) ----------------
  echo "⚡ Optimizing consensus parameters (300ms optimistic execution, 300s heartbeat)..."
  sed -i.bak 's/timeout_propose = "3s"/timeout_propose = "200ms"/g' "$CONFIG_TOML"
  sed -i.bak 's/timeout_propose_delta = "500ms"/timeout_propose_delta = "100ms"/g' "$CONFIG_TOML"
  sed -i.bak 's/timeout_prevote = "1s"/timeout_prevote = "150ms"/g' "$CONFIG_TOML"
  sed -i.bak 's/timeout_prevote_delta = "500ms"/timeout_prevote_delta = "100ms"/g' "$CONFIG_TOML"
  sed -i.bak 's/timeout_precommit = "1s"/timeout_precommit = "150ms"/g' "$CONFIG_TOML"
  sed -i.bak 's/timeout_precommit_delta = "500ms"/timeout_precommit_delta = "100ms"/g' "$CONFIG_TOML"
  sed -i.bak 's/timeout_commit = "5s"/timeout_commit = "1s"/g' "$CONFIG_TOML"
  sed -i.bak 's/timeout_broadcast_tx_commit = "10s"/timeout_broadcast_tx_commit = "2s"/g' "$CONFIG_TOML"
  sed -i.bak 's/type = "flood"/type = "app"/g' "$CONFIG_TOML"
  sed -i.bak 's/create_empty_blocks = true/create_empty_blocks = false/g' "$CONFIG_TOML"
  # 300-second empty block heartbeat
  sed -i.bak 's/create_empty_blocks_interval = "0s"/create_empty_blocks_interval = "300s"/g' "$CONFIG_TOML"

  # Enable APIs and metrics endpoints
  sed -i.bak 's/prometheus = false/prometheus = true/' "$CONFIG_TOML"
  sed -i.bak 's/prometheus-retention-time  = "0"/prometheus-retention-time  = "1000000000000"/g' "$APP_TOML"
  sed -i.bak 's/enabled = false/enabled = true/g' "$APP_TOML"
  sed -i.bak 's/enable = false/enable = true/g' "$APP_TOML"
  sed -i.bak 's/snapshot-interval = 0/snapshot-interval = 500/g' "$APP_TOML"

  # Clean backup configs
  rm -f $CHAINDIR/config/*.bak
fi

echo "=============================================================================="
echo "Aries Local Devnet Bootstrap Successful!"
echo "Native Denom: ARES (18 decimal aares)"
echo "Chain ID:     $CHAINID"
echo "Validator:    $VAL_KEY (60,000 ARES active stake)"
echo "EVM RPC Port: http://127.0.0.1:8545"
echo "=============================================================================="

# Start node execution daemon in a loop with PID tracking for dynamic config reloading
trap 'echo "Stopping ariesd loop..."; kill $ARIESD_PID 2>/dev/null; exit 0' SIGINT SIGTERM

PRUNING_FLAGS="--pruning custom --pruning-keep-recent 1000 --pruning-interval 10 --min-retain-blocks 1000"
if [[ $ARCHIVE_MODE == true ]]; then
  echo "📦 Running in full archive mode (pruning turned OFF)..."
  PRUNING_FLAGS="--pruning nothing"
fi

while true; do
  echo "🚀 Starting ariesd daemon..."
  ariesd start \
    $PRUNING_FLAGS \
    --log_level $LOGLEVEL \
    --minimum-gas-prices=1000000000aares \
    --evm.min-tip=100000000 \
    --home "$CHAINDIR" \
    --json-rpc.api eth,txpool,personal,net,debug,web3 \
    --json-rpc.address="0.0.0.0:8545" \
    --json-rpc.ws-address="0.0.0.0:8546" \
    --chain-id "$CHAINID" &
  ARIESD_PID=$!
  echo $ARIESD_PID > "$CHAINDIR/ariesd.pid"
  wait $ARIESD_PID
  EXIT_CODE=$?
  echo "💤 ariesd daemon exited with code $EXIT_CODE. Restarting in 1s..."
  sleep 1
done

