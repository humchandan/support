// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AriesGames {
    address public owner;
    
    // Scratch Card configs
    uint256 public scratchMinPrize = 1 * 1e18; // 1 ARES
    uint256 public scratchMaxPrize = 10 * 1e18; // 10 ARES
    uint256 public scratchCooldown = 1 days;
    mapping(address => uint256) public lastScratchTime;

    // Spinning Wheel configs
    string[] public coupons;
    uint256 public wheelCooldown = 1 days;
    mapping(address => uint256) public lastWheelSpinTime;

    event ScratchCardPlayed(address indexed user, uint256 prizeAmount);
    event WheelSpun(address indexed user, string couponCode);
    event PrizeRangeUpdated(uint256 min, uint256 max);
    event CouponAdded(string coupon);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() payable {
        owner = msg.sender;
        
        // Add some default coupons
        coupons.push("ARES10");
        coupons.push("ARES25");
        coupons.push("ARES50");
        coupons.push("LUCKY77");
        coupons.push("WELCOMEARES");
    }

    receive() external payable {}

    // Admin: Set Scratch Card prizes
    function setScratchCardPrizeRange(uint256 min, uint256 max) external onlyOwner {
        require(max >= min, "Max must be >= min");
        scratchMinPrize = min;
        scratchMaxPrize = max;
        emit PrizeRangeUpdated(min, max);
    }

    // Admin: Add new spinning wheel coupon
    function addCoupon(string calldata coupon) external onlyOwner {
        coupons.push(coupon);
        emit CouponAdded(coupon);
    }

    // Scratch Card game
    function playScratchCard() external {
        require(block.timestamp >= lastScratchTime[msg.sender] + scratchCooldown, "Daily scratch card already claimed");
        require(address(this).balance >= scratchMaxPrize, "Insufficient contract balance for prizes");

        lastScratchTime[msg.sender] = block.timestamp;

        // Pseudo-random calculation
        uint256 random = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender))) % (scratchMaxPrize - scratchMinPrize + 1);
        uint256 prize = scratchMinPrize + random;

        (bool success, ) = payable(msg.sender).call{value: prize}("");
        require(success, "Prize transfer failed");

        emit ScratchCardPlayed(msg.sender, prize);
    }

    // Spinning Wheel game
    function spinWheel() external {
        require(block.timestamp >= lastWheelSpinTime[msg.sender] + wheelCooldown, "Daily wheel spin already used");
        require(coupons.length > 0, "No coupons configured");

        lastWheelSpinTime[msg.sender] = block.timestamp;

        // Pseudo-random index selection
        uint256 randomIndex = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender))) % coupons.length;
        string memory winningCoupon = coupons[randomIndex];

        emit WheelSpun(msg.sender, winningCoupon);
    }

    // Admin: Withdraw funds
    function withdrawFunds(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient balance");
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Withdrawal failed");
    }
}
