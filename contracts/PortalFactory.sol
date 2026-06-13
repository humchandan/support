// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./AriesPortalWallet.sol";

contract PortalFactory is Ownable {
    address public immutable portalImplementation;
    address payable public masterWallet;

    event PortalCreated(bytes32 indexed userId, address indexed portalAddress);
    event MasterWalletUpdated(address indexed oldMaster, address indexed newMaster);

    constructor(address payable _masterWallet) Ownable(msg.sender) {
        require(_masterWallet != address(0), "Invalid master wallet");
        masterWallet = _masterWallet;
        
        // Deploy the base implementation contract, passing this factory's address
        portalImplementation = address(new AriesPortalWallet(address(this)));
    }

    // Deploys a lightweight EIP-1167 proxy wallet clone for a user
    function createPortal(bytes32 userId) external returns (address portalAddress) {
        address clone = Clones.clone(portalImplementation);
        emit PortalCreated(userId, clone);
        return clone;
    }

    // Upgrade the master wallet destination address
    function setMasterWallet(address payable _newMaster) external onlyOwner {
        require(_newMaster != address(0), "Invalid master wallet address");
        emit MasterWalletUpdated(masterWallet, _newMaster);
        masterWallet = _newMaster;
    }
}
