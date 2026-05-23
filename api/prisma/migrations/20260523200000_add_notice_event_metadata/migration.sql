-- AlterTable: Notice — status (DRAFT|PUBLISHED) e priority (NORMAL|URGENT)
ALTER TABLE `Notice`
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'PUBLISHED',
    ADD COLUMN `priority` VARCHAR(191) NOT NULL DEFAULT 'NORMAL';

-- AlterTable: Event — category, capacity, status (DRAFT|PUBLISHED|CANCELLED)
ALTER TABLE `Event`
    ADD COLUMN `category` VARCHAR(191) NOT NULL DEFAULT 'OUTRO',
    ADD COLUMN `capacity` INTEGER NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'PUBLISHED';

-- CreateTable: NoticeRead — tracking de leituras por morador
CREATE TABLE `NoticeRead` (
    `id` VARCHAR(191) NOT NULL,
    `noticeId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `readAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `NoticeRead_noticeId_userId_key`(`noticeId`, `userId`),
    INDEX `NoticeRead_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `NoticeRead` ADD CONSTRAINT `NoticeRead_noticeId_fkey` FOREIGN KEY (`noticeId`) REFERENCES `Notice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NoticeRead` ADD CONSTRAINT `NoticeRead_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
