# Blockscout Explorer Setup Guide

This directory contains the Docker Compose configurations required to launch a local Blockscout explorer instance configured for the **Aries Network** (Chain ID: `232425`) with **`ARES`** as the native token name and symbol.

## Configuration Details

To display the token name correctly in both the backend database and the frontend UI, the following parameters have been configured in [docker-compose.yml](file:///home/humchandan/.gemini/antigravity/scratch/genesis-blockchain/blockscout/docker-compose.yml):

1. **Backend Configuration (`backend` environment)**:
   - `COIN: 'ARES'`
   - `COIN_NAME: 'ARES'`
   - `METADATA_COIN_NAME: 'ARES'`
   - `CHAIN_ID: '232425'`
   - `ETHEREUM_JSONRPC_HTTP_URL: 'http://host.docker.internal:8545/'` (points back to Geth running on the host system)

2. **Frontend UI Configuration (`frontend` environment)**:
   - `NEXT_PUBLIC_NETWORK_CURRENCY_NAME: 'ARES'`
   - `NEXT_PUBLIC_NETWORK_CURRENCY_SYMBOL: 'ARES'`
   - `NEXT_PUBLIC_NETWORK_NAME: 'Aries Network'`
   - `NEXT_PUBLIC_NETWORK_ID: '232425'`

3. **Linux Networking**:
   - `extra_hosts: ["host.docker.internal:host-gateway"]` is added to both services. This maps the host's loopback interface to `host.docker.internal` inside the containers, enabling them to connect to your Geth node running on port `8545`.

---

## Deployment Steps

Since Docker is not currently installed on this system, you must run the following steps on a machine with Docker/Docker Compose installed:

### 1. Install Docker (If not already installed)
For Ubuntu/Debian:
```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
# Log out and log back in to apply group changes
```

### 2. Allow Remote Geth Connections
By default, Geth HTTP API listens on `127.0.0.1`. If Geth is running on the host machine and Blockscout runs inside Docker, make sure Geth's HTTP address is set to `127.0.0.1` but reachable, or bind it to `0.0.0.0` if necessary (be careful to firewall public ports). 
Using `host.docker.internal` maps directly to the host gateway interface.

### 3. Launch Blockscout
From this directory, run:
```bash
docker compose up -d
```

### 4. Access the Explorer
Once started, you can access:
- **Blockscout Frontend**: `http://localhost:9081`
- **Blockscout Backend / API**: `http://localhost:4000`
