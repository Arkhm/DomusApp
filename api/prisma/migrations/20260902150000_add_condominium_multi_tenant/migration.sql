-- Multi-tenancy: introduz `Condominium` como raiz de isolamento e vincula
-- User, Unit, Notice, Event e Voting a exatamente um condomínio.
--
-- As tabelas já têm dados em produção/dev, então `condominiumId` não pode
-- nascer NOT NULL. A migration segue o caminho seguro em quatro tempos:
--   1. cria a tabela e semeia um condomínio padrão;
--   2. adiciona a coluna como NULL;
--   3. faz o backfill das linhas existentes para o condomínio padrão;
--   4. só então trava em NOT NULL e cria as foreign keys.

-- CreateTable
CREATE TABLE `Condominium` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `cnpj` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Condominium_cnpj_key`(`cnpj`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Condomínio padrão: dono de todos os dados que já existiam antes do
-- multi-tenant. O UUID é fixo de propósito, para a migration ser
-- determinística em qualquer ambiente (dev, CI, produção).
INSERT INTO `Condominium` (`id`, `name`, `createdAt`, `updatedAt`)
VALUES ('00000000-0000-0000-0000-000000000001', 'Domus Residence', NOW(3), NOW(3));

-- AlterTable: coluna nullable primeiro
ALTER TABLE `User`   ADD COLUMN `condominiumId` VARCHAR(191) NULL;
ALTER TABLE `Unit`   ADD COLUMN `condominiumId` VARCHAR(191) NULL;
ALTER TABLE `Notice` ADD COLUMN `condominiumId` VARCHAR(191) NULL;
ALTER TABLE `Event`  ADD COLUMN `condominiumId` VARCHAR(191) NULL;
ALTER TABLE `Voting` ADD COLUMN `condominiumId` VARCHAR(191) NULL;

-- Backfill dos dados legados
UPDATE `User`   SET `condominiumId` = '00000000-0000-0000-0000-000000000001' WHERE `condominiumId` IS NULL;
UPDATE `Unit`   SET `condominiumId` = '00000000-0000-0000-0000-000000000001' WHERE `condominiumId` IS NULL;
UPDATE `Notice` SET `condominiumId` = '00000000-0000-0000-0000-000000000001' WHERE `condominiumId` IS NULL;
UPDATE `Event`  SET `condominiumId` = '00000000-0000-0000-0000-000000000001' WHERE `condominiumId` IS NULL;
UPDATE `Voting` SET `condominiumId` = '00000000-0000-0000-0000-000000000001' WHERE `condominiumId` IS NULL;

-- AlterTable: agora sim, obrigatório
ALTER TABLE `User`   MODIFY `condominiumId` VARCHAR(191) NOT NULL;
ALTER TABLE `Unit`   MODIFY `condominiumId` VARCHAR(191) NOT NULL;
ALTER TABLE `Notice` MODIFY `condominiumId` VARCHAR(191) NOT NULL;
ALTER TABLE `Event`  MODIFY `condominiumId` VARCHAR(191) NOT NULL;
ALTER TABLE `Voting` MODIFY `condominiumId` VARCHAR(191) NOT NULL;

-- AddForeignKey — RESTRICT impede apagar um condomínio que ainda tem dados.
-- O MySQL cria automaticamente o índice de cada FK, que é exatamente o índice
-- que o filtro por tenant vai usar nas queries.
ALTER TABLE `User`   ADD CONSTRAINT `User_condominiumId_fkey`   FOREIGN KEY (`condominiumId`) REFERENCES `Condominium`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Unit`   ADD CONSTRAINT `Unit_condominiumId_fkey`   FOREIGN KEY (`condominiumId`) REFERENCES `Condominium`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Notice` ADD CONSTRAINT `Notice_condominiumId_fkey` FOREIGN KEY (`condominiumId`) REFERENCES `Condominium`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Event`  ADD CONSTRAINT `Event_condominiumId_fkey`  FOREIGN KEY (`condominiumId`) REFERENCES `Condominium`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Voting` ADD CONSTRAINT `Voting_condominiumId_fkey` FOREIGN KEY (`condominiumId`) REFERENCES `Condominium`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
