ALTER TABLE `Invoice` ADD COLUMN `currentPaymentAttemptId` VARCHAR(191) NULL;
UPDATE `Invoice` i JOIN `PaymentAttempt` a ON a.invoiceId = i.id SET i.currentPaymentAttemptId = a.id;
CREATE INDEX `PaymentAttempt_invoiceId_idx` ON `PaymentAttempt`(`invoiceId`);
DROP INDEX `PaymentAttempt_invoiceId_key` ON `PaymentAttempt`;
