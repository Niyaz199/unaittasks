import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canAccessDailyChecklists,
  canManageDailyChecklistTemplates,
  canReadDailyChecklistControl,
  isDailyChecklistTemplateRole,
} from "@/lib/daily-checklists/access";
import { getDailyChecklistSignedUrls } from "@/lib/daily-checklists/files";
import { filterTemplateItemsForDate, normalizeOperationalDate } from "@/lib/daily-checklists/scheduler";
import type {
  DailyChecklistAttachment,
  DailyChecklistControlRow,
  DailyChecklistDayData,
  DailyChecklistItemRun,
  DailyChecklistRole,
  DailyChecklistRun,
  DailyChecklistScheduleConfig,
  DailyChecklistTemplate,
  DailyChecklistTemplateItem,
  DailyChecklistTemplateProfile,
  Profile,
} from "@/lib/types";

type TemplateRow = {
  id: string;
  profile_id: string;
  role_snapshot: DailyChecklistRole;
  version: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  archived_at: string | null;
  profile?: { full_name: string; role: DailyChecklistRole } | Array<{ full_name: string; role: DailyChecklistRole }> | null;
  items?: Array<{
    id: string;
    template_id: string;
    sort_order: number;
    title: string;
    description: string | null;
    schedule_type: DailyChecklistTemplateItem["schedule_type"];
    schedule_config: DailyChecklistScheduleConfig | null;
    schedule_label: string;
    is_required: boolean;
    allow_task_escalation: boolean;
    created_at?: string;
  }> | null;
};

type RunRow = {
  id: string;
  profile_id: string;
  role_snapshot: DailyChecklistRole;
  operational_date: string;
  template_id: string | null;
  template_name: string;
  status: DailyChecklistRun["status"];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type ItemRunRow = {
  id: string;
  run_id: string;
  template_item_id: string | null;
  sort_order: number;
  title: string;
  description: string | null;
  schedule_type: DailyChecklistTemplateItem["schedule_type"];
  schedule_config: DailyChecklistScheduleConfig | null;
  schedule_label: string;
  is_required: boolean;
  allow_task_escalation: boolean;
  status: DailyChecklistItemRun["status"];
  comment: string | null;
  linked_task_id: string | null;
  linked_object_id: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
  run?: Pick<RunRow, "operational_date"> | null;
};

type AttachmentRow = DailyChecklistAttachment;

function resolveProfile(row: TemplateRow["profile"]) {
  return Array.isArray(row) ? row[0] ?? null : row ?? null;
}

function mapTemplateItem(row: NonNullable<TemplateRow["items"]>[number]): DailyChecklistTemplateItem {
  return {
    id: row.id,
    template_id: row.template_id,
    sort_order: row.sort_order,
    title: row.title,
    description: row.description ?? null,
    schedule_type: row.schedule_type,
    schedule_config: (row.schedule_config ?? {}) as DailyChecklistScheduleConfig,
    schedule_label: row.schedule_label,
    is_required: row.is_required,
    allow_task_escalation: row.allow_task_escalation,
    created_at: row.created_at,
  };
}

function mapTemplate(row: TemplateRow): DailyChecklistTemplate {
  const profile = resolveProfile(row.profile);
  return {
    id: row.id,
    profile_id: row.profile_id,
    profile_name: profile?.full_name ?? "Пользователь",
    role: row.role_snapshot,
    version: row.version,
    name: row.name,
    description: row.description ?? null,
    is_active: row.is_active,
    created_at: row.created_at,
    created_by: row.created_by ?? null,
    archived_at: row.archived_at ?? null,
    items: (row.items ?? []).map((item) => mapTemplateItem(item)).sort((a, b) => a.sort_order - b.sort_order),
  };
}

function mapRun(row: RunRow): DailyChecklistRun {
  return {
    id: row.id,
    profile_id: row.profile_id,
    role_snapshot: row.role_snapshot,
    operational_date: row.operational_date,
    template_id: row.template_id ?? null,
    template_name: row.template_name,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at ?? null,
  };
}

function mapItemRun(row: ItemRunRow): DailyChecklistItemRun {
  return {
    id: row.id,
    run_id: row.run_id,
    operational_date: row.run?.operational_date,
    template_item_id: row.template_item_id ?? null,
    sort_order: row.sort_order,
    title: row.title,
    description: row.description ?? null,
    schedule_type: row.schedule_type,
    schedule_config: (row.schedule_config ?? {}) as DailyChecklistScheduleConfig,
    schedule_label: row.schedule_label,
    is_required: row.is_required,
    allow_task_escalation: row.allow_task_escalation,
    status: row.status,
    comment: row.comment ?? null,
    linked_task_id: row.linked_task_id ?? null,
    linked_object_id: row.linked_object_id ?? null,
    completed_at: row.completed_at ?? null,
    completed_by: row.completed_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function buildCompletion(items: DailyChecklistItemRun[]) {
  const total = items.length;
  const completed = items.filter((item) => item.status === "done").length;
  const problems = items.filter((item) => item.status === "problem").length;
  const requiredItems = items.filter((item) => item.is_required);
  const requiredTotal = requiredItems.length;
  const requiredResolved = requiredItems.filter((item) => item.status !== "pending").length;
  const percentBase = requiredTotal || total;
  const percentValue = percentBase ? Math.round((requiredResolved / percentBase) * 100) : 100;
  return { total, completed, problems, requiredTotal, requiredResolved, percent: percentValue };
}

async function getActiveTemplateForProfileId(
  supabase: SupabaseClient,
  profileId: string
): Promise<DailyChecklistTemplate | null> {
  const { data, error } = await supabase
    .from("daily_checklist_templates")
    .select(
      "id,profile_id,role_snapshot,version,name,description,is_active,created_at,created_by,archived_at,profile:profiles!daily_checklist_templates_profile_id_fkey(full_name,role),items:daily_checklist_template_items(id,template_id,sort_order,title,description,schedule_type,schedule_config,schedule_label,is_required,allow_task_escalation,created_at)"
    )
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .is("archived_at", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTemplate(data as unknown as TemplateRow) : null;
}

async function getRunByProfileAndDate(supabase: SupabaseClient, profileId: string, operationalDate: string) {
  const { data, error } = await supabase
    .from("daily_checklist_runs")
    .select("id,profile_id,role_snapshot,operational_date,template_id,template_name,status,created_at,updated_at,completed_at")
    .eq("profile_id", profileId)
    .eq("operational_date", operationalDate)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRun(data as RunRow) : null;
}

async function loadAttachmentsByItemRunIds(supabase: SupabaseClient, itemRunIds: string[]) {
  if (!itemRunIds.length) return new Map<string, DailyChecklistAttachment[]>();
  const { data, error } = await supabase
    .from("daily_checklist_item_attachments")
    .select("id,item_run_id,storage_path,file_name,mime_type,size_bytes,uploaded_by,created_at,cleanup_after,deleted_at")
    .in("item_run_id", itemRunIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as AttachmentRow[];
  const signedUrls = await getDailyChecklistSignedUrls(supabase, rows.map((row) => row.storage_path));
  const grouped = new Map<string, DailyChecklistAttachment[]>();
  for (const row of rows) {
    const list = grouped.get(row.item_run_id) ?? [];
    list.push({ ...row, url: signedUrls[row.storage_path] ?? null });
    grouped.set(row.item_run_id, list);
  }
  return grouped;
}

async function loadRunItemsWithAttachments(supabase: SupabaseClient, runId: string) {
  const { data, error } = await supabase
    .from("daily_checklist_item_runs")
    .select("id,run_id,template_item_id,sort_order,title,description,schedule_type,schedule_config,schedule_label,is_required,allow_task_escalation,status,comment,linked_task_id,linked_object_id,completed_at,completed_by,created_at,updated_at")
    .eq("run_id", runId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as ItemRunRow[];
  const attachmentsByItemId = await loadAttachmentsByItemRunIds(supabase, rows.map((row) => row.id));
  return rows.map((row) => ({ ...mapItemRun(row), attachments: attachmentsByItemId.get(row.id) ?? [] }));
}

async function materializeRunFromTemplate(
  supabase: SupabaseClient,
  profile: Profile,
  template: DailyChecklistTemplate,
  operationalDate: string
) {
  const { data: insertedRun, error: runError } = await supabase
    .from("daily_checklist_runs")
    .insert({
      profile_id: profile.id,
      role_snapshot: profile.role,
      operational_date: operationalDate,
      template_id: template.id,
      template_name: template.name,
    })
    .select("id,profile_id,role_snapshot,operational_date,template_id,template_name,status,created_at,updated_at,completed_at")
    .single();
  if (runError) throw runError;

  const matchingItems = filterTemplateItemsForDate(template.items ?? [], operationalDate);
  if (matchingItems.length) {
    const itemRows = matchingItems.map((item) => ({
      run_id: insertedRun.id,
      template_item_id: item.id,
      sort_order: item.sort_order,
      title: item.title,
      description: item.description ?? null,
      schedule_type: item.schedule_type,
      schedule_config: item.schedule_config ?? {},
      schedule_label: item.schedule_label,
      is_required: item.is_required,
      allow_task_escalation: item.allow_task_escalation,
    }));
    const { error: itemError } = await supabase.from("daily_checklist_item_runs").insert(itemRows);
    if (itemError) throw itemError;
  }

  return mapRun(insertedRun as RunRow);
}

export async function listDailyChecklistTemplateProfilesForProfile(
  supabase: SupabaseClient,
  profile: Profile
): Promise<DailyChecklistTemplateProfile[]> {
  if (!canManageDailyChecklistTemplates(profile.role)) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,role")
    .in("role", ["lead", "engineer", "object_engineer"])
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DailyChecklistTemplateProfile[];
}

export async function listDailyChecklistTemplatesForProfile(supabase: SupabaseClient, profile: Profile) {
  if (!canManageDailyChecklistTemplates(profile.role)) {
    if (!isDailyChecklistTemplateRole(profile.role)) return [] as DailyChecklistTemplate[];
    const template = await getActiveTemplateForProfileId(supabase, profile.id);
    return template ? [template] : [];
  }

  const { data, error } = await supabase
    .from("daily_checklist_templates")
    .select(
      "id,profile_id,role_snapshot,version,name,description,is_active,created_at,created_by,archived_at,profile:profiles!daily_checklist_templates_profile_id_fkey(full_name,role),items:daily_checklist_template_items(id,template_id,sort_order,title,description,schedule_type,schedule_config,schedule_label,is_required,allow_task_escalation,created_at)"
    )
    .eq("is_active", true)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapTemplate(row as unknown as TemplateRow));
}

export async function getOrCreateDailyChecklistDayForProfile(
  supabase: SupabaseClient,
  profile: Profile,
  requestedDate?: string | null
): Promise<DailyChecklistDayData> {
  if (!canAccessDailyChecklists(profile.role) || !isDailyChecklistTemplateRole(profile.role)) {
    return { run: null, overdueItems: [], completion: buildCompletion([]) };
  }

  const operationalDate = normalizeOperationalDate(requestedDate);
  let run = await getRunByProfileAndDate(supabase, profile.id, operationalDate);
  if (!run) {
    const template = await getActiveTemplateForProfileId(supabase, profile.id);
    if (!template) {
      return { run: null, overdueItems: [], completion: buildCompletion([]) };
    }
    run = await materializeRunFromTemplate(supabase, profile, template, operationalDate);
  }

  const items = await loadRunItemsWithAttachments(supabase, run.id);
  const overdueItems = await listDailyChecklistOverdueItemsForProfile(supabase, profile, operationalDate);
  return { run: { ...run, items }, overdueItems, completion: buildCompletion(items) };
}

export async function listDailyChecklistOverdueItemsForProfile(
  supabase: SupabaseClient,
  profile: Profile,
  beforeDate?: string
) {
  const effectiveDate = normalizeOperationalDate(beforeDate);
  const { data, error } = await supabase
    .from("daily_checklist_item_runs")
    .select("id,run_id,template_item_id,sort_order,title,description,schedule_type,schedule_config,schedule_label,is_required,allow_task_escalation,status,comment,linked_task_id,linked_object_id,completed_at,completed_by,created_at,updated_at,run:daily_checklist_runs!inner(operational_date)")
    .eq("status", "pending")
    .eq("is_required", true)
    .eq("run.profile_id", profile.id)
    .lt("run.operational_date", effectiveDate)
    .order("operational_date", { referencedTable: "run", ascending: false })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapItemRun(row as unknown as ItemRunRow));
}

export async function recomputeDailyChecklistRunStatus(supabase: SupabaseClient, runId: string) {
  const { data, error } = await supabase.from("daily_checklist_item_runs").select("status,is_required").eq("run_id", runId);
  if (error) throw error;
  const items = (data ?? []) as Array<{ status: DailyChecklistItemRun["status"]; is_required: boolean }>;
  const allRequiredResolved = items.filter((item) => item.is_required).every((item) => item.status !== "pending");
  const nextStatus: DailyChecklistRun["status"] = allRequiredResolved ? "completed" : "in_progress";
  const { error: updateError } = await supabase
    .from("daily_checklist_runs")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
      completed_at: nextStatus === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", runId);
  if (updateError) throw updateError;
}

export async function getDailyChecklistItemRunForProfile(
  supabase: SupabaseClient,
  profile: Profile,
  itemRunId: string
) {
  if (!canAccessDailyChecklists(profile.role) && !canReadDailyChecklistControl(profile.role)) return null;

  const { data, error } = await supabase
    .from("daily_checklist_item_runs")
    .select("id,run_id,template_item_id,sort_order,title,description,schedule_type,schedule_config,schedule_label,is_required,allow_task_escalation,status,comment,linked_task_id,linked_object_id,completed_at,completed_by,created_at,updated_at,run:daily_checklist_runs!inner(id,profile_id,role_snapshot,operational_date,template_id,template_name,status,created_at,updated_at,completed_at)")
    .eq("id", itemRunId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as ItemRunRow & { run: RunRow };
  if (!canReadDailyChecklistControl(profile.role) && row.run.profile_id !== profile.id) return null;

  const attachments = await loadAttachmentsByItemRunIds(supabase, [itemRunId]);
  return {
    item: {
      ...mapItemRun({ ...row, run: { operational_date: row.run.operational_date } }),
      attachments: attachments.get(itemRunId) ?? [],
    },
    run: mapRun(row.run),
  };
}

export async function getDailyChecklistRunByIdForProfile(
  supabase: SupabaseClient,
  profile: Profile,
  runId: string
): Promise<DailyChecklistDayData | null> {
  if (!canReadDailyChecklistControl(profile.role) && !canAccessDailyChecklists(profile.role)) return null;

  const { data, error } = await supabase
    .from("daily_checklist_runs")
    .select("id,profile_id,role_snapshot,operational_date,template_id,template_name,status,created_at,updated_at,completed_at")
    .eq("id", runId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const run = mapRun(data as RunRow);

  if (!canReadDailyChecklistControl(profile.role) && run.profile_id !== profile.id) {
    return null;
  }

  const items = await loadRunItemsWithAttachments(supabase, run.id);
  return { run: { ...run, items }, overdueItems: [], completion: buildCompletion(items) };
}

export async function listDailyChecklistControlProfilesForProfile(supabase: SupabaseClient, profile: Profile) {
  if (!canReadDailyChecklistControl(profile.role)) return [] as DailyChecklistTemplateProfile[];
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,role")
    .in("role", ["lead", "engineer", "object_engineer"])
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DailyChecklistTemplateProfile[];
}

export async function listDailyChecklistControlRowsForProfile(
  supabase: SupabaseClient,
  profile: Profile,
  filters?: {
    operationalDate?: string | null;
    role?: DailyChecklistRole | "all";
    profileId?: string | "all";
  }
) {
  if (!canReadDailyChecklistControl(profile.role)) return [] as DailyChecklistControlRow[];

  let query = supabase
    .from("daily_checklist_runs")
    .select("id,profile_id,role_snapshot,operational_date,status,profiles!daily_checklist_runs_profile_id_fkey(full_name)")
    .order("operational_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters?.operationalDate) query = query.eq("operational_date", normalizeOperationalDate(filters.operationalDate));
  if (filters?.role && filters.role !== "all") query = query.eq("role_snapshot", filters.role);
  if (filters?.profileId && filters.profileId !== "all") query = query.eq("profile_id", filters.profileId);

  const { data, error } = await query;
  if (error) throw error;
  const runRows = (data ?? []) as unknown as Array<{
    id: string;
    profile_id: string;
    role_snapshot: DailyChecklistRole;
    operational_date: string;
    status: DailyChecklistRun["status"];
    profiles?: { full_name: string } | Array<{ full_name: string }> | null;
  }>;
  const runIds = runRows.map((row) => row.id);
  if (!runIds.length) return [] as DailyChecklistControlRow[];

  const { data: itemsData, error: itemsError } = await supabase
    .from("daily_checklist_item_runs")
    .select("run_id,status,is_required,linked_task_id")
    .in("run_id", runIds);
  if (itemsError) throw itemsError;

  const grouped = new Map<string, Array<{ status: DailyChecklistItemRun["status"]; is_required: boolean; linked_task_id: string | null }>>();
  for (const row of (itemsData ?? []) as Array<{ run_id: string; status: DailyChecklistItemRun["status"]; is_required: boolean; linked_task_id: string | null }>) {
    const list = grouped.get(row.run_id) ?? [];
    list.push(row);
    grouped.set(row.run_id, list);
  }

  return runRows.map((row) => {
    const items = grouped.get(row.id) ?? [];
    const fullName = Array.isArray(row.profiles) ? row.profiles[0]?.full_name ?? "Пользователь" : row.profiles?.full_name ?? "Пользователь";
    return {
      run_id: row.id,
      profile_id: row.profile_id,
      full_name: fullName,
      role: row.role_snapshot,
      operational_date: row.operational_date,
      status: row.status,
      total_items: items.length,
      completed_items: items.filter((item) => item.status === "done").length,
      problem_items: items.filter((item) => item.status === "problem").length,
      pending_required_items: items.filter((item) => item.is_required && item.status === "pending").length,
      linked_tasks: items.filter((item) => item.linked_task_id).length,
    } satisfies DailyChecklistControlRow;
  });
}
