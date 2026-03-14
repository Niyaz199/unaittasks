import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { canAccessPprModule } from "@/lib/ppr/permissions";
import { getPprQrRedirectHref, resolvePprQrTokenForProfile } from "@/lib/ppr/qr";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { supabase, profile } = await getApiSession();

  if (!profile || !canAccessPprModule(profile.role)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const resolution = await resolvePprQrTokenForProfile(supabase, profile, token);
  if (resolution.kind === "task" || resolution.kind === "equipment") {
    return NextResponse.redirect(new URL(getPprQrRedirectHref(resolution), request.url));
  }

  return NextResponse.redirect(new URL(`/ppr/qr/${encodeURIComponent(token)}`, request.url));
}
