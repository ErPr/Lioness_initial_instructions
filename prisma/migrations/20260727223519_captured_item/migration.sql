-- CreateTable
CREATE TABLE "CapturedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT,
    "rawText" TEXT,
    "imagePath" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "metaImage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "boardId" TEXT,
    "nodeId" TEXT,
    "contributionType" TEXT,
    "aiConfidence" REAL,
    "aiCandidates" TEXT,
    "aiSource" TEXT,
    "dedupeOf" TEXT,
    "shareCount" INTEGER NOT NULL DEFAULT 1,
    "enrichAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdPostId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CapturedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CapturedItem_userId_status_idx" ON "CapturedItem"("userId", "status");

-- CreateIndex
CREATE INDEX "CapturedItem_status_idx" ON "CapturedItem"("status");

-- CreateIndex
CREATE INDEX "CapturedItem_nodeId_idx" ON "CapturedItem"("nodeId");
