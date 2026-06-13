// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPortalFactory {
    function masterWallet() external view returns (address payable);
}

contract AriesPortalWallet {
    address public immutable factory;

    event Received(address indexed sender, uint256 amount);
    event SweptERC20(address indexed token, uint256 amount);

    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory address");
        factory = _factory;
    }

    // Fallback function to receive native ARES and forward immediately to the master wallet
    receive() external payable {
        uint256 amount = msg.value;
        require(amount > 0, "Amount must be positive");

        emit Received(msg.sender, amount);
        
        // Query factory dynamically for the current master wallet address
        address payable masterWallet = IPortalFactory(factory).masterWallet();
        require(masterWallet != address(0), "Master wallet not configured");

        // Forward ARES to the master custodial wallet
        (bool success, ) = masterWallet.call{value: amount}("");
        require(success, "Forwarding native ARES failed");
    }

    // Sweep any ERC20 tokens deposited here to the master wallet
    function sweepERC20(address tokenAddress) external {
        require(tokenAddress != address(0), "Invalid token address");
        
        address payable masterWallet = IPortalFactory(factory).masterWallet();
        require(masterWallet != address(0), "Master wallet not configured");
        
        uint256 balance = IERC20(tokenAddress).balanceOf(address(this));
        require(balance > 0, "No token balance to sweep");
        
        emit SweptERC20(tokenAddress, balance);
        
        bool success = IERC20(tokenAddress).transfer(masterWallet, balance);
        require(success, "Sweeping ERC20 failed");
    }
}

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
}
