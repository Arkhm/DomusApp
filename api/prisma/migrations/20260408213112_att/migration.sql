-- AlterTable
ALTER TABLE `Notice` ADD COLUMN `targetUnitId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Notice` ADD CONSTRAINT `Notice_targetUnitId_fkey` FOREIGN KEY (`targetUnitId`) REFERENCES `Unit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
