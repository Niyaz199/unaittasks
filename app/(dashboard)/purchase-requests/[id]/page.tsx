import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { canAccessPurchaseRequestsModule, canManagePurchaseRequests } from "@/lib/capabilities";
import { getPurchaseRequestByIdForProfile } from "@/lib/purchase-requests/queries";
import { BackButton } from "@/components/ui/back-button";
import { PageHeader } from "@/components/ui/page-header";
import { PurchaseRequestDetails } from "@/components/purchase-requests/purchase-request-details";

export default async function PurchaseRequestDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const search = searchParams ? await searchParams : {};
  const from = typeof search.from === "string" ? search.from : "/purchase-requests";
  const { profile, supabase } = await requireProfile();

  if (!canAccessPurchaseRequestsModule(profile.role)) {
    return <div className="empty-state">Доступ к закупкам запрещён.</div>;
  }

  const request = await getPurchaseRequestByIdForProfile(supabase, profile, id);
  if (!request) {
    notFound();
  }

  return (
    <section className="grid">
      <PageHeader
        title="Карточка заявки на закупку"
        description="Детальная карточка заявки с позициями, перераспределением и изменением статуса."
        actions={<BackButton fallback={from} />}
      />
      <PurchaseRequestDetails
        request={request}
        actorRole={profile.role}
        actorId={profile.id}
        canManage={canManagePurchaseRequests(profile.role)}
      />
    </section>
  );
}
