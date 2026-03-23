import { redirect } from "next/navigation";

export default async function RoundsEntryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/rounds/scan?token=${encodeURIComponent(token)}`);
}
