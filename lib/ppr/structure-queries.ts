import type { SupabaseClient } from "@supabase/supabase-js";
import { listObjectRoomsForProfile } from "@/lib/object-rooms";
import type { Profile } from "@/lib/types";
import {
  RESPONSIBLE_ROLES,
  assertPprQrQueryAccess,
  assertPprStructureQueryAccess,
  assertPprSystemGroupQueryAccess,
  assertPprTemplateQueryAccess,
  listPprManageableObjectsForProfile,
} from "@/lib/ppr/access";

export async function listPprSystemGroups(supabase: SupabaseClient, profile: Pick<Profile, "role">) {
  assertPprStructureQueryAccess(profile.role);
  const { data, error } = await supabase
    .from("ppr_system_groups")
    .select("id,name,code,is_active")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; name: string; code: string; is_active: boolean }>;
}

export async function listPprSystemGroupsForManagement(supabase: SupabaseClient, profile: Pick<Profile, "role">) {
  assertPprSystemGroupQueryAccess(profile.role);
  return listPprSystemGroups(supabase, profile);
}

export async function listPprResponsibleCandidates(
  supabase: SupabaseClient,
  objectIds: string[]
): Promise<Array<{ id: string; full_name: string; role: "lead" | "engineer" | "object_engineer"; object_ids: string[] }>> {
  if (!objectIds.length) return [];

  const { data: links, error: linksError } = await supabase
    .from("user_objects")
    .select("user_id,object_id")
    .in("object_id", objectIds);
  if (linksError) throw linksError;

  const candidateIds = [...new Set((links ?? []).map((row) => row.user_id))];
  if (!candidateIds.length) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id,full_name,role")
    .in("id", candidateIds)
    .in("role", [...RESPONSIBLE_ROLES])
    .order("full_name", { ascending: true });
  if (profilesError) throw profilesError;

  const objectIdsByUser = new Map<string, string[]>();
  for (const link of links ?? []) {
    const current = objectIdsByUser.get(link.user_id) ?? [];
    if (!current.includes(link.object_id)) current.push(link.object_id);
    objectIdsByUser.set(link.user_id, current);
  }

  return ((profiles ?? []) as Array<{ id: string; full_name: string; role: "lead" | "engineer" | "object_engineer" }>).map(
    (profileRow) => ({
      ...profileRow,
      object_ids: objectIdsByUser.get(profileRow.id) ?? [],
    })
  );
}

export async function listPprSystemsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  options: { objectId?: string } = {}
) {
  assertPprStructureQueryAccess(profile.role);
  const objects = await listPprManageableObjectsForProfile(supabase, profile);
  if (!objects.length && profile.role !== "admin" && profile.role !== "chief") return [];

  let query = supabase
    .from("ppr_systems")
    .select(
      "id,object_id,system_group_id,name,description,responsible_user_id,is_active,created_at,object:objects(name),system_group:ppr_system_groups(name),responsible:profiles(full_name,role)"
    )
    .order("name", { ascending: true });
  if (options.objectId) {
    query = query.eq("object_id", options.objectId);
  }

  const { data, error } =
    profile.role === "admin" || profile.role === "chief" ? await query : await query.in("object_id", objects.map((item) => item.id));
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    object_id: string;
    system_group_id: string;
    name: string;
    description: string | null;
    responsible_user_id: string | null;
    is_active: boolean;
    created_at: string;
    object: { name: string } | Array<{ name: string }> | null;
    system_group: { name: string } | Array<{ name: string }> | null;
    responsible: { full_name: string; role: string } | Array<{ full_name: string; role: string }> | null;
  }>;
}

export async function listPprRoomsForProfile(supabase: SupabaseClient, profile: Pick<Profile, "id" | "role">) {
  assertPprStructureQueryAccess(profile.role);
  return listObjectRoomsForProfile(supabase, profile);
}

export async function listPprEquipmentForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  options: { objectId?: string } = {}
) {
  assertPprStructureQueryAccess(profile.role);
  const objects = await listPprManageableObjectsForProfile(supabase, profile);
  if (!objects.length && profile.role !== "admin" && profile.role !== "chief") return [];

  let query = supabase
    .from("ppr_equipment")
    .select(
      "id,object_id,system_id,room_id,inventory_no,name,dispatch_name,service_start_date,status,serial_no,manufacturer,model,description,comment,created_at,object:objects(name),system:ppr_systems(name),room:object_rooms(name,floor,floor_ref:floors(name),room_type:room_types(name))"
    )
    .order("created_at", { ascending: false });
  if (options.objectId) {
    query = query.eq("object_id", options.objectId);
  }

  const { data, error } =
    profile.role === "admin" || profile.role === "chief" ? await query : await query.in("object_id", objects.map((item) => item.id));
  if (error) throw error;

  return (data ?? []) as Array<{
    id: string;
    object_id: string;
    system_id: string;
    room_id: string;
    inventory_no: string;
    name: string;
    dispatch_name: string;
    service_start_date: string;
    status: "active" | "repair" | "out_of_service" | "archived";
    serial_no: string | null;
    manufacturer: string | null;
    model: string | null;
    description: string | null;
    comment: string | null;
    created_at: string;
    object: { name: string } | Array<{ name: string }> | null;
    system: { name: string } | Array<{ name: string }> | null;
    room:
      | {
          name: string;
          floor: string | null;
          floor_ref: { name: string } | Array<{ name: string }> | null;
          room_type: { name: string } | Array<{ name: string }> | null;
        }
      | Array<{
          name: string;
          floor: string | null;
          floor_ref: { name: string } | Array<{ name: string }> | null;
          room_type: { name: string } | Array<{ name: string }> | null;
        }>
      | null;
  }>;
}

export async function getPprEquipmentByIdForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  equipmentId: string
) {
  assertPprStructureQueryAccess(profile.role);

  const { data, error } = await supabase
    .from("ppr_equipment")
    .select(
      "id,object_id,system_id,room_id,inventory_no,name,dispatch_name,service_start_date,status,serial_no,manufacturer,model,description,comment,created_at,object:objects(name),system:ppr_systems(name),room:object_rooms(name,floor,floor_ref:floors(name),room_type:room_types(name))"
    )
    .eq("id", equipmentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const manageableObjects = await listPprManageableObjectsForProfile(supabase, profile);
  const canAccess =
    profile.role === "admin" || profile.role === "chief" || manageableObjects.some((item) => item.id === data.object_id);
  if (!canAccess) return null;

  const { data: qrCode, error: qrError } = await supabase
    .from("ppr_equipment_qr_codes")
    .select("id,object_id,equipment_id,qr_token,is_active,generated_at")
    .eq("equipment_id", equipmentId)
    .eq("is_active", true)
    .maybeSingle();
  if (qrError) throw qrError;

  return {
    equipment: data as {
      id: string;
      object_id: string;
      system_id: string;
      room_id: string;
      inventory_no: string;
      name: string;
      dispatch_name: string;
      service_start_date: string;
      status: "active" | "repair" | "out_of_service" | "archived";
      serial_no: string | null;
      manufacturer: string | null;
      model: string | null;
      description: string | null;
      comment: string | null;
      created_at: string;
      object: { name: string } | Array<{ name: string }> | null;
      system: { name: string } | Array<{ name: string }> | null;
      room:
        | {
            name: string;
            floor: string | null;
            floor_ref: { name: string } | Array<{ name: string }> | null;
            room_type: { name: string } | Array<{ name: string }> | null;
          }
        | Array<{
            name: string;
            floor: string | null;
            floor_ref: { name: string } | Array<{ name: string }> | null;
            room_type: { name: string } | Array<{ name: string }> | null;
          }>
        | null;
    },
    qrCode: (qrCode ?? null) as
      | {
          id: string;
          object_id: string;
          equipment_id: string;
          qr_token: string;
          is_active: boolean;
          generated_at: string;
        }
      | null,
  };
}

export async function getPprEquipmentQrCodeByToken(
  supabase: SupabaseClient,
  profile: Pick<Profile, "role">,
  qrToken: string
) {
  assertPprQrQueryAccess(profile.role);

  const { data, error } = await supabase.rpc("ppr_resolve_qr_token", { _token: qrToken });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] ?? null : data ?? null;
  return row as
    | {
        id: string;
        object_id: string;
        equipment_id: string;
        qr_token: string;
        is_active: boolean;
        generated_at: string;
      }
    | null;
}

export async function listPprWorkTemplatesForProfile(supabase: SupabaseClient, profile: Pick<Profile, "id" | "role">) {
  assertPprTemplateQueryAccess(profile.role);
  const objects = await listPprManageableObjectsForProfile(supabase, profile);
  if (!objects.length && profile.role !== "admin" && profile.role !== "chief") return [];

  const query = supabase
    .from("ppr_work_templates")
    .select(
      "id,object_id,system_id,name,description,period_months,base_start_date,norm_hours,methodology,is_active,created_at,object:objects(name),system:ppr_systems(name)"
    )
    .order("created_at", { ascending: false });

  const { data, error } =
    profile.role === "admin" || profile.role === "chief" ? await query : await query.in("object_id", objects.map((item) => item.id));
  if (error) throw error;

  return (data ?? []) as Array<{
    id: string;
    object_id: string;
    system_id: string;
    name: string;
    description: string | null;
    period_months: number;
    base_start_date: string;
    norm_hours: number | null;
    methodology: string | null;
    is_active: boolean;
    created_at: string;
    object: { name: string } | Array<{ name: string }> | null;
    system: { name: string } | Array<{ name: string }> | null;
  }>;
}

export async function getPprWorkTemplateByIdForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  templateId: string
) {
  assertPprTemplateQueryAccess(profile.role);

  const { data: template, error: templateError } = await supabase
    .from("ppr_work_templates")
    .select(
      "id,object_id,system_id,name,description,period_months,base_start_date,norm_hours,methodology,is_active,created_at,object:objects(name),system:ppr_systems(name)"
    )
    .eq("id", templateId)
    .maybeSingle();
  if (templateError) throw templateError;
  if (!template) return null;

  const manageableObjects = await listPprManageableObjectsForProfile(supabase, profile);
  const canAccess =
    profile.role === "admin" || profile.role === "chief" || manageableObjects.some((item) => item.id === template.object_id);
  if (!canAccess) return null;

  const { data: checklistItems, error: checklistError } = await supabase
    .from("ppr_work_checklist_items")
    .select("id,object_id,template_id,sort_order,title,description")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });
  if (checklistError) throw checklistError;

  return {
    template: template as {
      id: string;
      object_id: string;
      system_id: string;
      name: string;
      description: string | null;
      period_months: number;
      base_start_date: string;
      norm_hours: number | null;
      methodology: string | null;
      is_active: boolean;
      created_at: string;
      object: { name: string } | Array<{ name: string }> | null;
      system: { name: string } | Array<{ name: string }> | null;
    },
    checklistItems: (checklistItems ?? []) as Array<{
      id: string;
      object_id: string;
      template_id: string;
      sort_order: number;
      title: string;
      description: string | null;
    }>,
  };
}

