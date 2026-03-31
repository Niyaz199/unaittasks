"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";

const updateOwnProfileSchema = z.object({
  fullName: z.string().trim().min(1, "Введите ФИО.")
});

export type UpdateOwnProfileResult =
  | { ok: true; fullName: string; message: string }
  | { ok: false; error: string };

export async function updateOwnProfileAction(formData: FormData): Promise<UpdateOwnProfileResult> {
  try {
    const { supabase, profile } = await requireProfile();
    const payload = updateOwnProfileSchema.parse({
      fullName: String(formData.get("full_name") ?? "")
    });

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: payload.fullName })
      .eq("id", profile.id);

    if (error) {
      return { ok: false, error: "Не удалось сохранить ФИО." };
    }

    revalidatePath("/profile");
    return {
      ok: true,
      fullName: payload.fullName,
      message: "Личные данные сохранены."
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Проверьте введенные данные." };
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "Не удалось сохранить профиль."
    };
  }
}
