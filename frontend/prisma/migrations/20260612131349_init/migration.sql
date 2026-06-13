-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `walletAddress` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `mobile` VARCHAR(191) NOT NULL,
    `sponsorAddress` VARCHAR(191) NOT NULL,
    `proxyAddress` VARCHAR(191) NULL,
    `rank` VARCHAR(191) NOT NULL DEFAULT 'Default',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_walletAddress_key`(`walletAddress`),
    UNIQUE INDEX `User_proxyAddress_key`(`proxyAddress`),
    INDEX `User_walletAddress_idx`(`walletAddress`),
    INDEX `User_sponsorAddress_idx`(`sponsorAddress`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StakingPlan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userAddress` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(20, 8) NOT NULL,
    `txHash` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `StakingPlan_txHash_key`(`txHash`),
    INDEX `StakingPlan_userAddress_idx`(`userAddress`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LedgerEntry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userAddress` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(20, 8) NOT NULL,
    `netAmount` DECIMAL(20, 8) NOT NULL,
    `fee` DECIMAL(20, 8) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `txHash` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LedgerEntry_userAddress_idx`(`userAddress`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClaimHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userAddress` VARCHAR(191) NOT NULL,
    `grossAmount` DECIMAL(20, 8) NOT NULL,
    `netAmount` DECIMAL(20, 8) NOT NULL,
    `destination` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ClaimHistory_userAddress_idx`(`userAddress`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
