import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";
import {
  getPprEquipmentByIdForProfile,
  getPprEquipmentQrCodeByToken,
  getPreferredActivePprTaskForEquipmentForProfile,
} from "@/lib/ppr/queries";

export type PprQrResolution =
  | { kind: "task"; taskId: string; equipmentId: string }
  | { kind: "equipment"; equipmentId: string }
  | { kind: "invalid" }
  | { kind: "forbidden" };

export async function resolvePprQrTokenForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  token: string
): Promise<PprQrResolution> {
  const normalizedToken = token.trim();
  if (!normalizedToken) return { kind: "invalid" };

  const qrCode = await getPprEquipmentQrCodeByToken(supabase, profile, normalizedToken);
  if (!qrCode) return { kind: "invalid" };

  const activeTask = await getPreferredActivePprTaskForEquipmentForProfile(supabase, profile, qrCode.equipment_id);
  if (activeTask) {
    return {
      kind: "task",
      taskId: activeTask.id,
      equipmentId: qrCode.equipment_id,
    };
  }

  const equipment = await getPprEquipmentByIdForProfile(supabase, profile, qrCode.equipment_id).catch(() => null);
  if (equipment) {
    return {
      kind: "equipment",
      equipmentId: qrCode.equipment_id,
    };
  }

  return { kind: "invalid" };
}

export function getPprQrRedirectHref(resolution: Extract<PprQrResolution, { kind: "task" | "equipment" }>) {
  if (resolution.kind === "task") {
    return `/ppr/tasks/${resolution.taskId}`;
  }
  return `/ppr/equipment/${resolution.equipmentId}`;
}
