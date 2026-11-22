CREATE TABLE `InboxNotification` (
 `id` VARCHAR(191) NOT NULL, `key` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL,
 `type` VARCHAR(16) NOT NULL, `sourceId` VARCHAR(191) NOT NULL, `title` VARCHAR(191) NOT NULL,
 `description` VARCHAR(191) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `readAt` DATETIME(3) NULL,
 UNIQUE INDEX `InboxNotification_key_key`(`key`), INDEX `InboxNotification_userId_createdAt_idx`(`userId`, `createdAt`),
 PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
