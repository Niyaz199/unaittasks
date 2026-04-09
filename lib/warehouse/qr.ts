import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";
import { getStockLocationByIdForProfile, getStockLocationQrCodeByTokenForProfile } from "@/lib/warehouse/queries";

export type WarehouseQrResolution =
  | { kind: "location"; locationId: string }
  | { kind: "invalid" };

export async function resolveWarehouseQrTokenForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  token: string
): Promise<WarehouseQrResolution> {
  const normalizedToken = token.trim();
  if (!normalizedToken) return { kind: "invalid" };

  const qrCode = await getStockLocationQrCodeByTokenForProfile(supabase, profile, normalizedToken);
  if (!qrCode) return { kind: "invalid" };

  const location = await getStockLocationByIdForProfile(supabase, profile, qrCode.location_id).catch(() => null);
  if (!location) return { kind: "invalid" };

  return { kind: "location", locationId: qrCode.location_id };
}

export function getWarehouseQrRedirectHref(resolution: Extract<WarehouseQrResolution, { kind: "location" }>) {
  return `/warehouse/locations/${resolution.locationId}`;
}
