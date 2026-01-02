"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  return redirect("/");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const nama = formData.get("nama") as string;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: nama },
    },
  });

  if (error || !data.user) {
    return redirect(`/register?error=${encodeURIComponent(error?.message || "Terjadi kesalahan")}`);
  }

  // Simpan data user ke database Prisma (public.User)
  await db.user.create({
    data: {
      id: data.user.id, // ID dari Supabase Auth
      email: email,
      nama: nama,
      role: "user",
      isVerified: "pending",
    },
  });

  return redirect("/waiting");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return redirect("/login");
}