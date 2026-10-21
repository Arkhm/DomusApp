-- CreateTable
CREATE TABLE `VotingVote` (
    `id` VARCHAR(191) NOT NULL,
    `votingId` VARCHAR(191) NOT NULL,
    `optionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VotingVote_optionId_idx`(`optionId`),
    INDEX `VotingVote_userId_idx`(`userId`),
    UNIQUE INDEX `VotingVote_votingId_userId_key`(`votingId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VotingVote` ADD CONSTRAINT `VotingVote_votingId_fkey` FOREIGN KEY (`votingId`) REFERENCES `Voting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VotingVote` ADD CONSTRAINT `VotingVote_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `VotingOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VotingVote` ADD CONSTRAINT `VotingVote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
