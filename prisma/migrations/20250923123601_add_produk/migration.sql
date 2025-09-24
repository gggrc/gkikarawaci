-- CreateTable
CREATE TABLE "public"."Ibadah" (
    "id_ibadah" TEXT NOT NULL,
    "jenis_kebaktian" TEXT NOT NULL,
    "sesi_ibadah" INTEGER NOT NULL,
    "tanggal_ibadah" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ibadah_pkey" PRIMARY KEY ("id_ibadah")
);

-- CreateTable
CREATE TABLE "public"."Kehadiran" (
    "id_kehadiran" TEXT NOT NULL,
    "id_ibadah" TEXT NOT NULL,
    "id_jemaat" TEXT NOT NULL,

    CONSTRAINT "Kehadiran_pkey" PRIMARY KEY ("id_kehadiran")
);

-- CreateTable
CREATE TABLE "public"."Jemaat" (
    "id_jemaat" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jabatan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "tanggal_lahir" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "age" INTEGER NOT NULL,
    "handphone" TEXT NOT NULL,

    CONSTRAINT "Jemaat_pkey" PRIMARY KEY ("id_jemaat")
);

-- CreateTable
CREATE TABLE "public"."Statistics" (
    "stat_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "Statistics_pkey" PRIMARY KEY ("stat_id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "user_id" SERIAL NOT NULL,
    "clerkId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tanggal_lahir" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "jabatan" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "public"."User"("clerkId");

-- AddForeignKey
ALTER TABLE "public"."Kehadiran" ADD CONSTRAINT "Kehadiran_id_ibadah_fkey" FOREIGN KEY ("id_ibadah") REFERENCES "public"."Ibadah"("id_ibadah") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Kehadiran" ADD CONSTRAINT "Kehadiran_id_jemaat_fkey" FOREIGN KEY ("id_jemaat") REFERENCES "public"."Jemaat"("id_jemaat") ON DELETE RESTRICT ON UPDATE CASCADE;
