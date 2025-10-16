-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "isVerified" SET DEFAULT 'pending',
ALTER COLUMN "isVerified" SET DATA TYPE TEXT;
