/*
  Warnings:

  - A unique constraint covering the columns `[clickupTaskId]` on the table `Post` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "clickupTaskId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Post_clickupTaskId_key" ON "Post"("clickupTaskId");
