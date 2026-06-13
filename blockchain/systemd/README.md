# Ubuntu systemd Services Setup Guide

This guide details how to install and manage the Aries blockchain nodes and consensus client as background systemd services on Ubuntu.

## Installation

1. Copy the systemd service files to the system configuration directory:
   ```bash
   sudo cp geth-node1.service /etc/systemd/system/
   sudo cp geth-node2.service /etc/systemd/system/
   sudo cp aries-consensus.service /etc/systemd/system/
   ```

2. Reload systemd daemon to load the new service definitions:
   ```bash
   sudo systemctl daemon-reload
   ```

## Starting Services

Start the Geth execution nodes:
```bash
sudo systemctl start geth-node1
sudo systemctl start geth-node2
```

Start the Aries consensus client:
```bash
sudo systemctl start aries-consensus
```

## Enable Services on Boot

To configure the services to start automatically when the system boots:
```bash
sudo systemctl enable geth-node1
sudo systemctl enable geth-node2
sudo systemctl enable aries-consensus
```

## Monitoring & Logs

### Check Status
Check if the services are active and running:
```bash
sudo systemctl status geth-node1
sudo systemctl status geth-node2
sudo systemctl status aries-consensus
```

### View Live Logs
View the stdout/stderr logs in real-time using `journalctl`:
```bash
# Geth Node 1 logs
journalctl -u geth-node1 -f

# Geth Node 2 logs
journalctl -u geth-node2 -f

# Consensus client logs
journalctl -u aries-consensus -f
```

## Managing Services

### Restart
```bash
sudo systemctl restart aries-consensus
```

### Stop
```bash
sudo systemctl stop aries-consensus geth-node2 geth-node1
```
