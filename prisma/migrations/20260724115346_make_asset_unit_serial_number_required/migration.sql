/*
  Warnings:

  - Made the column `serialNumber` on table `AssetUnit` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "AssetUnit" ALTER COLUMN "serialNumber" SET NOT NULL;
