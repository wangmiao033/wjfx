-- 个人中心：提测记录表（Supabase SQL Editor 可直接执行）
-- 若已存在则跳过，可重复执行

CREATE TABLE IF NOT EXISTS "DeliverRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "publisher" TEXT NOT NULL DEFAULT '',
    "developer" TEXT NOT NULL DEFAULT '',
    "pastProducts" TEXT NOT NULL DEFAULT '',
    "productNode" TEXT NOT NULL DEFAULT '',
    "productTypes" TEXT NOT NULL DEFAULT '[]',
    "privacyPolicyUrl" TEXT NOT NULL DEFAULT '',
    "userAgreementUrl" TEXT NOT NULL DEFAULT '',
    "testAccounts" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "shareCode" TEXT,
    "downloadLink" TEXT,
    "extractPassword" TEXT,
    "pushMessage" TEXT,
    "packageFileName" TEXT,
    "packageFileSize" INTEGER,
    "attachments" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeliverRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DeliverRecord_userId_updatedAt_idx"
    ON "DeliverRecord"("userId", "updatedAt");

DO $$ BEGIN
    ALTER TABLE "DeliverRecord"
        ADD CONSTRAINT "DeliverRecord_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
