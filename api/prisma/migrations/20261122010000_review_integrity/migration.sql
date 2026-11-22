CREATE UNIQUE INDEX `PaymentAttempt_invoiceId_id_key` ON `PaymentAttempt`(`invoiceId`, `id`);
CREATE INDEX `Invoice_id_currentPaymentAttemptId_idx` ON `Invoice`(`id`, `currentPaymentAttemptId`);
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_id_currentPaymentAttemptId_fkey` FOREIGN KEY (`id`, `currentPaymentAttemptId`) REFERENCES `PaymentAttempt`(`invoiceId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
DELETE n FROM `InboxNotification` n LEFT JOIN `User` u ON u.id = n.userId WHERE u.id IS NULL;
ALTER TABLE `InboxNotification` ADD CONSTRAINT `InboxNotification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
