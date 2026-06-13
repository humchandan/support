// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AriesValidatorRegistry {
    struct Validator {
        address validatorAddress;
        uint256 selfStake;
        uint256 delegatedStake;
        uint256 totalStake;
        bool isEligible; // totalStake >= 51,000 ARES
        uint256 registrationTime;
    }

    uint256 public constant MIN_STAKE = 51000 * 1e18; // 51,000 ARES (18 decimals)
    uint256 public constant EPOCH_BLOCKS = 86400; // 1 day epoch in blocks
    uint256 public constant TOP_SPOTS = 7;
    uint256 public constant ROTATION_SPOTS = 14;
    uint256 public constant MAX_VALIDATORS = 21;

    address[] public validatorAddresses;
    mapping(address => Validator) public validators;
    mapping(address => address[]) public delegators;
    mapping(address => mapping(address => uint256)) public delegations; // delegator => validator => amount

    address[] public activeValidators;
    uint256 public currentEpoch;
    uint256 public lastRotationBlock;

    event ValidatorRegistered(address indexed validator, uint256 stake);
    event Staked(address indexed validator, uint256 amount);
    event Delegated(address indexed delegator, address indexed validator, uint256 amount);
    event Unstaked(address indexed validator, uint256 amount);
    event Undelegated(address indexed delegator, address indexed validator, uint256 amount);
    event ValidatorsRotated(uint256 indexed epoch, address[] newActiveValidators);

    constructor(address[] memory initialValidators, uint256[] memory initialStakes) payable {
        require(initialValidators.length >= 2, "Min 2 initial validators required");
        require(initialValidators.length == initialStakes.length, "Mismatched inputs");

        for (uint256 i = 0; i < initialValidators.length; i++) {
            address val = initialValidators[i];
            uint256 stakeAmount = initialStakes[i];
            require(stakeAmount >= MIN_STAKE, "Stake below minimum");

            validators[val] = Validator({
                validatorAddress: val,
                selfStake: stakeAmount,
                delegatedStake: 0,
                totalStake: stakeAmount,
                isEligible: true,
                registrationTime: block.timestamp
            });
            validatorAddresses.push(val);
            emit ValidatorRegistered(val, stakeAmount);
        }

        currentEpoch = block.number / EPOCH_BLOCKS;
        lastRotationBlock = block.number;
        _updateActiveValidators();
    }

    receive() external payable {}

    // Register a new validator
    function registerValidator() external payable {
        require(validators[msg.sender].validatorAddress == address(0), "Already registered");
        require(msg.value >= MIN_STAKE, "Insufficient minimum stake");

        validators[msg.sender] = Validator({
            validatorAddress: msg.sender,
            selfStake: msg.value,
            delegatedStake: 0,
            totalStake: msg.value,
            isEligible: true,
            registrationTime: block.timestamp
        });
        validatorAddresses.push(msg.sender);

        emit ValidatorRegistered(msg.sender, msg.value);
        checkAndTriggerRotation();
    }

    // Increase self-stake
    function stakeMore() external payable {
        Validator storage val = validators[msg.sender];
        require(val.validatorAddress != address(0), "Not registered");
        require(msg.value > 0, "Amount must be positive");

        val.selfStake += msg.value;
        val.totalStake += msg.value;
        if (val.totalStake >= MIN_STAKE) {
            val.isEligible = true;
        }

        emit Staked(msg.sender, msg.value);
        checkAndTriggerRotation();
    }

    // Delegate stake to an existing validator
    function delegate(address validatorAddr) external payable {
        require(msg.value > 0, "Amount must be positive");
        Validator storage val = validators[validatorAddr];
        require(val.validatorAddress != address(0), "Validator not registered");

        if (delegations[msg.sender][validatorAddr] == 0) {
            delegators[validatorAddr].push(msg.sender);
        }

        delegations[msg.sender][validatorAddr] += msg.value;
        val.delegatedStake += msg.value;
        val.totalStake += msg.value;
        if (val.totalStake >= MIN_STAKE) {
            val.isEligible = true;
        }

        emit Delegated(msg.sender, validatorAddr, msg.value);
        checkAndTriggerRotation();
    }

    // Unstake validator funds
    function unstake(uint256 amount) external {
        Validator storage val = validators[msg.sender];
        require(val.validatorAddress != address(0), "Not registered");
        require(val.selfStake >= amount, "Insufficient self-stake balance");
        
        uint256 newSelfStake = val.selfStake - amount;
        val.selfStake = newSelfStake;
        val.totalStake -= amount;

        if (val.totalStake < MIN_STAKE) {
            val.isEligible = false;
        }

        payable(msg.sender).transfer(amount);
        emit Unstaked(msg.sender, amount);
        checkAndTriggerRotation();
    }

    // Withdraw delegation
    function undelegate(address validatorAddr, uint256 amount) external {
        uint256 delegatedAmount = delegations[msg.sender][validatorAddr];
        require(delegatedAmount >= amount, "Insufficient delegated balance");

        delegations[msg.sender][validatorAddr] -= amount;
        Validator storage val = validators[validatorAddr];
        val.delegatedStake -= amount;
        val.totalStake -= amount;

        if (val.totalStake < MIN_STAKE) {
            val.isEligible = false;
        }

        payable(msg.sender).transfer(amount);
        emit Undelegated(msg.sender, validatorAddr, amount);
        checkAndTriggerRotation();
    }

    // Trigger validator rotation if epoch has passed
    function checkAndTriggerRotation() public {
        uint256 epoch = block.number / EPOCH_BLOCKS;
        if (epoch > currentEpoch) {
            currentEpoch = epoch;
            lastRotationBlock = block.number;
            _updateActiveValidators();
        }
    }

    // Return current active validators
    function getActiveValidators() external view returns (address[] memory) {
        return activeValidators;
    }

    // Sort and calculate active validators
    function _updateActiveValidators() internal {
        // 1. Gather all eligible validators
        address[] memory eligible = new address[](validatorAddresses.length);
        uint256 eligibleCount = 0;
        for (uint256 i = 0; i < validatorAddresses.length; i++) {
            if (validators[validatorAddresses[i]].isEligible) {
                eligible[eligibleCount] = validatorAddresses[i];
                eligibleCount++;
            }
        }

        // Handle case where eligible validators <= MAX_VALIDATORS
        if (eligibleCount <= MAX_VALIDATORS) {
            address[] memory result = new address[](eligibleCount);
            for (uint256 i = 0; i < eligibleCount; i++) {
                result[i] = eligible[i];
            }
            activeValidators = result;
            emit ValidatorsRotated(currentEpoch, activeValidators);
            return;
        }

        // 2. Sort all eligible validators by totalStake descending (Bubble sort for simplicity/on-chain execution)
        address[] memory sorted = new address[](eligibleCount);
        for (uint256 i = 0; i < eligibleCount; i++) {
            sorted[i] = eligible[i];
        }

        for (uint256 i = 0; i < eligibleCount - 1; i++) {
            for (uint256 j = 0; j < eligibleCount - i - 1; j++) {
                if (validators[sorted[j]].totalStake < validators[sorted[j + 1]].totalStake) {
                    address temp = sorted[j];
                    sorted[j] = sorted[j + 1];
                    sorted[j + 1] = temp;
                }
            }
        }

        // 3. Extract Top 7 spots
        address[] memory activeList = new address[](MAX_VALIDATORS);
        for (uint256 i = 0; i < TOP_SPOTS; i++) {
            activeList[i] = sorted[i];
        }

        // 4. Gather remaining pool for the 14 rotated spots
        uint256 poolSize = eligibleCount - TOP_SPOTS;
        address[] memory pool = new address[](poolSize);
        for (uint256 i = 0; i < poolSize; i++) {
            pool[i] = sorted[TOP_SPOTS + i];
        }

        // Determine starting offset for round-robin rotation based on current epoch
        uint256 startOffset = (currentEpoch * ROTATION_SPOTS) % poolSize;

        for (uint256 i = 0; i < ROTATION_SPOTS; i++) {
            uint256 index = (startOffset + i) % poolSize;
            activeList[TOP_SPOTS + i] = pool[index];
        }

        activeValidators = activeList;
        emit ValidatorsRotated(currentEpoch, activeValidators);
    }
}
