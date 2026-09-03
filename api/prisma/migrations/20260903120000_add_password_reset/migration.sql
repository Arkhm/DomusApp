-- AlterTable: User — RF-007 (recuperação de senha) + invalidação de sessão
--
-- `resetToken` guarda o SHA-256 (64 chars hex) do token enviado por email, não
-- o token em si. UNIQUE porque o lookup do /auth/reset-password é feito por ele
-- e o índice evita varredura de tabela a cada tentativa.
--
-- `passwordChangedAt` permite ao /auth/refresh recusar refresh tokens emitidos
-- antes da última troca de senha (sem isso um reset não derrubaria a sessão
-- roubada pelos 7 dias de validade do refresh token).
ALTER TABLE `User`
    ADD COLUMN `resetToken` VARCHAR(191) NULL,
    ADD COLUMN `resetTokenExpiry` DATETIME(3) NULL,
    ADD COLUMN `passwordChangedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_resetToken_key` ON `User`(`resetToken`);
