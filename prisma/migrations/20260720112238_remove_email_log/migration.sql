/*
  Warnings:

  - You are about to drop the `EmailLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EmailLog" DROP CONSTRAINT "EmailLog_templateId_fkey";

-- DropTable
DROP TABLE "EmailLog";

-- DropEnum
DROP TYPE "EmailStatus";
