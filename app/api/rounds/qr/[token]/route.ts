import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { canUseRoundsScanner } from "@/lib/rounds/permissions";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { profile } = await getApiSession();
  if (!profile || !canUseRoundsScanner(profile.role)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.redirect(new URL(`/rounds/scan?token=${encodeURIComponent(token)}`, request.url));
}
