-- CreateTable
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `type` VARCHAR(191) NOT NULL DEFAULT 'MONTHLY_FEE',
    `referenceMonth` DATETIME(3) NULL,
    `mpOrderId` VARCHAR(191) NULL,
    `mpPaymentId` VARCHAR(191) NULL,
    `mpPreferenceId` VARCHAR(191) NULL,
    `mpStatus` VARCHAR(191) NULL,
    `mpStatusDetail` VARCHAR(191) NULL,
    `mpQrCode` TEXT NULL,
    `mpQrCodeBase64` TEXT NULL,
    `mpBoletoUrl` VARCHAR(191) NULL,
    `mpResponse` TEXT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `paidAt` DATETIME(3) NULL,

    UNIQUE INDEX `Invoice_mpOrderId_key`(`mpOrderId`),
    UNIQUE INDEX `Invoice_mpPaymentId_key`(`mpPaymentId`),
    INDEX `Invoice_userId_idx`(`userId`),
    INDEX `Invoice_unitId_idx`(`unitId`),
    INDEX `Invoice_status_idx`(`status`),
    INDEX `Invoice_dueDate_idx`(`dueDate`),
    INDEX `Invoice_referenceMonth_idx`(`referenceMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;