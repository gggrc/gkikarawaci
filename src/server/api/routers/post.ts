import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const ibadahRouter = createTRPCRouter({
  createIbadah: publicProcedure
    .input(
      z.object({
        id_ibadah: z.string(),
        jenis_kebaktian: z.string(),
        sesi_ibadah: z.number(),
        tanggal_ibadah: z.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.ibadah.create({
        data: {
          id_ibadah: input.id_ibadah,
          jenis_kebaktian: input.jenis_kebaktian,
          sesi_ibadah: input.sesi_ibadah,
          tanggal_ibadah: input.tanggal_ibadah,
        },
      });
    }),

  getLatestIbadah: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.ibadah.findFirst({
      orderBy: { tanggal_ibadah: "desc" },
    });
  }),

  getAllIbadah: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.ibadah.findMany({
      orderBy: { tanggal_ibadah: "desc" },
    });
  }),


  createKehadiran: publicProcedure
    .input(
      z.object({
        id_kehadiran: z.string(),
        id_ibadah: z.string(),
        id_jemaat: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.kehadiran.create({
        data: {
          id_kehadiran: input.id_kehadiran,
          id_ibadah: input.id_ibadah,
          id_jemaat: input.id_jemaat,
        },
      });
    }),

  getKehadiranByIbadah: publicProcedure
    .input(z.object({ id_ibadah: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.kehadiran.findMany({
        where: { id_ibadah: input.id_ibadah },
        include: { jemaat: true },
      });
    }),

  getAllJemaat: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.jemaat.findMany({
      orderBy: { name: "asc" },
    });
  }),

  getJemaatById: publicProcedure
    .input(z.object({ id_jemaat: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.jemaat.findUnique({
        where: { id_jemaat: input.id_jemaat },
        include: { kehadiran: true },
      });
    }),
});
