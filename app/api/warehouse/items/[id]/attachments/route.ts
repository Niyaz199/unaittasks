import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import {
  STOCK_ITEM_MAX_FILES_PER_UPLOAD,
  uploadStockItemAttachmentFile,
  validateStockItemAttachmentFile,
} from "@/lib/warehouse/stock-item-files";
import { canManageWarehouseCatalog } from "@/lib/capabilities";
import { hasActorScopedObjectAccessForProfile } from "@/lib/access/object-scope";
import { isGlobalObjectScopeRole } from "@/lib/access/matrix";

function revalidateItemPaths(stockItemId: string) {
  revalidatePath("/warehouse/items");
  revalidatePath(`/warehouse/items/${stockItemId}`);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: stockItemId } = await params;
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!canManageWarehouseCatalog(profile.role)) {
      return NextResponse.json({ error: "Нет прав на загрузку файлов ТМЦ" }, { status: 403 });
    }

    const { data: stockItem, error: itemError } = await supabase
      .from("stock_items")
      .select("id,object_id")
      .eq("id", stockItemId)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!stockItem) return NextResponse.json({ error: "ТМЦ не найдена" }, { status: 404 });

    const canAccess =
      isGlobalObjectScopeRole(profile.role) ||
      (await hasActorScopedObjectAccessForProfile(supabase, profile, stockItem.object_id));
    if (!canAccess) return NextResponse.json({ error: "Объект недоступен" }, { status: 403 });

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "Файлы не переданы" }, { status: 400 });
    }
    if (files.length > STOCK_ITEM_MAX_FILES_PER_UPLOAD) {
      return NextResponse.json(
        { error: `Максимум ${STOCK_ITEM_MAX_FILES_PER_UPLOAD} файлов за раз` },
        { status: 400 }
      );
    }

    for (const file of files) {
      const validationError = validateStockItemAttachmentFile(file);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
    }

    const uploaded: unknown[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        const meta = await uploadStockItemAttachmentFile(supabase, file, profile.id, stockItemId);
        const { data: row, error } = await supabase
          .from("stock_item_attachments")
          .insert({
            object_id: stockItem.object_id,
            stock_item_id: stockItemId,
            storage_path: meta.storage_path,
            file_name: meta.file_name,
            mime_type: meta.mime_type,
            size_bytes: meta.size_bytes,
            uploaded_by: profile.id,
          })
          .select("id,object_id,stock_item_id,storage_path,file_name,mime_type,size_bytes,uploaded_by,created_at")
          .single();
        if (error) throw error;
        uploaded.push(row);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `Ошибка загрузки файла ${file.name}`);
      }
    }

    revalidateItemPaths(stockItemId);
    return NextResponse.json({ ok: true, uploaded, errors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: stockItemId } = await params;
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const attachmentId = url.searchParams.get("attachment_id");
    if (!attachmentId) {
      return NextResponse.json({ error: "attachment_id is required" }, { status: 400 });
    }

    const { data: attachment, error: attachmentError } = await supabase
      .from("stock_item_attachments")
      .select("id,object_id,stock_item_id,storage_path,uploaded_by")
      .eq("id", attachmentId)
      .eq("stock_item_id", stockItemId)
      .maybeSingle();
    if (attachmentError) throw attachmentError;
    if (!attachment) return NextResponse.json({ error: "Вложение не найдено" }, { status: 404 });

    const canDelete =
      attachment.uploaded_by === profile.id ||
      (canManageWarehouseCatalog(profile.role) &&
        (isGlobalObjectScopeRole(profile.role) ||
          (await hasActorScopedObjectAccessForProfile(supabase, profile, attachment.object_id))));
    if (!canDelete) {
      return NextResponse.json({ error: "Нет прав на удаление вложения" }, { status: 403 });
    }

    const { error: storageError } = await supabase.storage
      .from("stock-item-attachments")
      .remove([attachment.storage_path]);
    if (storageError) throw storageError;

    const { error: dbError } = await supabase
      .from("stock_item_attachments")
      .delete()
      .eq("id", attachmentId);
    if (dbError) throw dbError;

    revalidateItemPaths(stockItemId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
