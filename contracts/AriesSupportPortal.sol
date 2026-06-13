// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SimpleOwnable {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Ownable: initial owner is the zero address");
        _owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function owner() public view returns (address) {
        return _owner;
    }

    modifier onlyOwner() {
        require(_owner == msg.sender, "Ownable: caller is not the owner");
        _;
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}

contract AriesSupportPortal is SimpleOwnable {
    struct UserPlan {
        uint256 totalDeposited; // Lifetime deposited ARES (validation purchases)
        uint256 totalClaimed;   // Lifetime claimed ARES (withdrawn earnings)
    }

    mapping(address => UserPlan) public userPlans;

    address public trustedSigner;
    address payable public feeRecipient;

    event PlanPurchased(address indexed user, uint256 amount, uint256 timestamp);
    event RewardsClaimed(
        address indexed user,
        address indexed utilityAddress,
        uint256 grossAmount,
        uint256 feeAmount,
        uint256 primaryAmount,
        uint256 utilityAmount
    );
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    constructor(address _trustedSigner, address payable _feeRecipient) SimpleOwnable(msg.sender) {
        require(_trustedSigner != address(0), "Invalid trusted signer");
        require(_feeRecipient != address(0), "Invalid fee recipient");
        trustedSigner = _trustedSigner;
        feeRecipient = _feeRecipient;
    }

    // Purchase a Validation/Support Plan
    function purchasePlan() external payable {
        uint256 amount = msg.value;
        require(amount >= 100 * 1e18, "Minimum purchase is 100 ARES");
        require(amount % (100 * 1e18) == 0, "Purchase must be in multiples of 100 ARES");

        userPlans[msg.sender].totalDeposited += amount;

        emit PlanPurchased(msg.sender, amount, block.timestamp);
    }

    // Claim yield and MLM rewards using a backend signature
    function claimRewards(
        address utilityAddress,
        uint256 totalEligible,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(utilityAddress != address(0), "Invalid utility address");
        require(deadline >= block.timestamp, "Signature expired");

        uint256 deposited = userPlans[msg.sender].totalDeposited;
        require(deposited > 0, "No active plans purchased");

        // Enforce the 2x (200%) lifetime capping logic
        uint256 maxLimit = deposited * 2;
        require(totalEligible <= maxLimit, "Exceeds 2x payout cap");

        // Verify rewards haven't already been claimed
        uint256 claimed = userPlans[msg.sender].totalClaimed;
        require(totalEligible > claimed, "No new rewards to claim");

        uint256 grossPayout = totalEligible - claimed;

        // Verify ECDSA Signature (Pure Solidity)
        bytes32 hash = keccak256(abi.encodePacked(msg.sender, utilityAddress, totalEligible, deadline, address(this)));
        bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        address recoveredSigner = recoverSigner(messageHash, signature);
        require(recoveredSigner == trustedSigner, "Invalid signature");

        // Update total claimed state
        userPlans[msg.sender].totalClaimed = totalEligible;

        // Deduct 10% fee
        uint256 fee = (grossPayout * 10) / 100;
        uint256 netPayout = grossPayout - fee;

        // Split net payout 50/50
        uint256 payoutToPrimary = netPayout / 2;
        uint256 payoutToUtility = netPayout - payoutToPrimary; // Safely handles rounding of odd values

        // Route ARES
        // 1. Forward 10% fee
        (bool feeSuccess, ) = feeRecipient.call{value: fee}("");
        require(feeSuccess, "Fee transfer failed");

        // 2. Send 50% net to primary wallet
        (bool primarySuccess, ) = msg.sender.call{value: payoutToPrimary}("");
        require(primarySuccess, "Primary payout transfer failed");

        // 3. Send 50% net to utility address
        (bool utilitySuccess, ) = utilityAddress.call{value: payoutToUtility}("");
        require(utilitySuccess, "Utility payout transfer failed");

        emit RewardsClaimed(msg.sender, utilityAddress, grossPayout, fee, payoutToPrimary, payoutToUtility);
    }

    // Set new trusted backend signer address
    function setSignerAddress(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "Invalid signer address");
        emit SignerUpdated(trustedSigner, _newSigner);
        trustedSigner = _newSigner;
    }

    // Set new admin fee recipient address
    function setFeeRecipient(address payable _newRecipient) external onlyOwner {
        require(_newRecipient != address(0), "Invalid recipient address");
        emit FeeRecipientUpdated(feeRecipient, _newRecipient);
        feeRecipient = _newRecipient;
    }

    // Withdraw ARES reserve (emergency or rebalancing)
    function withdrawReserve(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient balance in contract");
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Withdraw reserve failed");
    }

    // Recover signer from signature (ECDSA pure solidity implementation)
    function recoverSigner(bytes32 _ethSignedMessageHash, bytes memory _sig) internal pure returns (address) {
        require(_sig.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            // first 32 bytes, after the length prefix
            r := mload(add(_sig, 32))
            // second 32 bytes
            s := mload(add(_sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(_sig, 96)))
        }

        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    // Enable contract to receive funding
    receive() external payable {}
}
