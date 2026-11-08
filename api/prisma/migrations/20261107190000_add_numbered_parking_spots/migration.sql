-- CreateTable
CREATE TABLE `ParkingSpot` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `type` ENUM('RESIDENT', 'VISITOR', 'DISABLED') NOT NULL,
    `unitId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ParkingSpot_number_key`(`number`),
    INDEX `ParkingSpot_unitId_idx`(`unitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ParkingSpot` ADD CONSTRAINT `ParkingSpot_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve existing limits with provisional numbers; management renames these spots.
-- Legacy routes accepted at most 20 spots per unit.
INSERT INTO `ParkingSpot` (`id`, `number`, `type`, `unitId`, `createdAt`, `updatedAt`)
WITH RECURSIVE spot_sequence AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM spot_sequence WHERE n < (SELECT COALESCE(MAX(`parkingSpots`), 0) FROM `Unit`)
)
SELECT UUID(), CONCAT('PROV-', UPPER(u.`id`), '-', spot_sequence.n), 'RESIDENT', u.`id`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `Unit` u JOIN spot_sequence ON spot_sequence.n <= u.`parkingSpots`;
