-- AlterTable
ALTER TABLE `Invoice` ADD COLUMN `operationId` VARCHAR(191) NULL,
    ADD COLUMN `paymentSource` VARCHAR(191) NULL,
    ADD COLUMN `requiresReview` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0,
    MODIFY `mpQrCode` TEXT NULL,
    MODIFY `mpResponse` LONGTEXT NULL;

-- CreateTable
CREATE TABLE `PaymentOperation` (
    `id` VARCHAR(191) NOT NULL,
    `keyHash` CHAR(64) NOT NULL,
    `requestHash` CHAR(64) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PaymentOperation_keyHash_key`(`keyHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentAttempt` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `externalReference` VARCHAR(191) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `environment` VARCHAR(191) NOT NULL,
    `sellerId` VARCHAR(191) NOT NULL,
    `requestPayload` JSON NOT NULL,
    `state` VARCHAR(191) NOT NULL DEFAULT 'QUEUED',
    `orderId` VARCHAR(191) NULL,
    `providerUpdatedAt` DATETIME(3) NULL,
    `providerVersion` INTEGER NULL,
    `expiresAt` DATETIME(3) NULL,
    `ticketUrl` TEXT NULL,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `retryAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lockedUntil` DATETIME(3) NULL,
    `lockToken` VARCHAR(191) NULL,
    `lastErrorCode` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaymentAttempt_invoiceId_key`(`invoiceId`),
    UNIQUE INDEX `PaymentAttempt_externalReference_key`(`externalReference`),
    UNIQUE INDEX `PaymentAttempt_idempotencyKey_key`(`idempotencyKey`),
    UNIQUE INDEX `PaymentAttempt_orderId_key`(`orderId`),
    INDEX `PaymentAttempt_state_retryAt_idx`(`state`, `retryAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentWebhook` (
    `id` VARCHAR(191) NOT NULL,
    `fingerprint` CHAR(64) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `environment` VARCHAR(191) NOT NULL,
    `sellerId` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `retryAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lockedUntil` DATETIME(3) NULL,
    `lockToken` VARCHAR(191) NULL,
    `lastErrorCode` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PaymentWebhook_fingerprint_key`(`fingerprint`),
    INDEX `PaymentWebhook_state_retryAt_idx`(`state`, `retryAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceAudit` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `reason` TEXT NULL,
    `fromStatus` VARCHAR(191) NOT NULL,
    `toStatus` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InvoiceAudit_invoiceId_createdAt_idx`(`invoiceId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `PaymentOperation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentAttempt` ADD CONSTRAINT `PaymentAttempt_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceAudit` ADD CONSTRAINT `InvoiceAudit_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE `Invoice` SET `requiresReview` = true WHERE `mpOrderId` IS NOT NULL;
