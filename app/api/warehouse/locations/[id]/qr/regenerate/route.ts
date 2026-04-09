import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { canManageWarehouseCatalog } from "@/lib/capabilities";
import { regenerateStockLocationQrCodeForProfile } from "@/lib/warehouse/queries";

function revalidateLocationQrPaths(locationId: string) {
  revalidatePath("/warehouse/locations");
  revalidatePath(`/warehouse/locations/${locationId}`);
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManageWarehouseCatalog(profile.role)) {
      return NextResponse.json({ error: "Недостаточно прав для пересоздания QR места хранения" }, { status: 403 });
    }

    const qrCode = await regenerateStockLocationQrCodeForProfile(supabase, profile, id);
    revalidateLocationQrPaths(id);
    return NextResponse.json({ ok: true, qrCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
