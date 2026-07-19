/*
  Warnings:

  - The primary key for the `StoreBusinessHour` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `StoreBusinessHour` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `StoreClosure` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_by` on the `StoreClosure` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by` on the `StoreClosure` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "StoreBusinessHour" DROP CONSTRAINT "StoreBusinessHour_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "StoreBusinessHour_pkey" PRIMARY KEY ("dayOfWeek");

-- AlterTable
ALTER TABLE "StoreClosure" DROP COLUMN "created_by",
DROP COLUMN "deleted_by",
DROP COLUMN "updated_by";
