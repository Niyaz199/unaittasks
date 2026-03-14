import type { Role } from "@/lib/types";

export type PprResponsibleRole = "lead" | "engineer" | "object_engineer";
export type PprTaskStatus = "new" | "in_progress" | "done" | "closed" | "cancelled";
export type PprEquipmentStatus = "active" | "repair" | "out_of_service" | "archived";
export type PprMonthPlanItemStatus = "pending" | "materialized" | "carried_over" | "closed" | "cancelled";

export type PprSystemGroup = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
};

export type PprSystem = {
  id: string;
  object_id: string;
  system_group_id: string;
  name: string;
  description: string | null;
  responsible_user_id: string | null;
  is_active: boolean;
};

export type PprSubsystem = {
  id: string;
  object_id: string;
  system_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type PprRoom = {
  id: string;
  object_id: string;
  name: string;
  floor: string | null;
  description: string | null;
  is_active: boolean;
};

export type PprEquipment = {
  id: string;
  object_id: string;
  system_id: string;
  subsystem_id: string;
  room_id: string;
  inventory_no: string;
  name: string;
  dispatch_name: string;
  service_start_date: string;
  status: PprEquipmentStatus;
  serial_no: string | null;
  manufacturer: string | null;
  model: string | null;
  description: string | null;
  comment: string | null;
};

export type PprEquipmentQrCode = {
  id: string;
  object_id: string;
  equipment_id: string;
  qr_token: string;
  is_active: boolean;
  generated_at: string;
};

export type PprEquipmentAttachment = {
  id: string;
  object_id: string;
  equipment_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
};

export type PprWorkTemplate = {
  id: string;
  object_id: string;
  subsystem_id: string;
  name: string;
  description: string | null;
  period_months: number;
  base_start_date: string;
  norm_hours: number | null;
  methodology: string | null;
  is_active: boolean;
};

export type PprWorkChecklistItem = {
  id: string;
  object_id: string;
  template_id: string;
  sort_order: number;
  title: string;
  description: string | null;
};

export type PprWorkTemplateAttachment = {
  id: string;
  object_id: string;
  template_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
};

export type PprEquipmentAssignment = {
  id: string;
  object_id: string;
  equipment_id: string;
  template_id: string;
  start_date: string;
  period_months: number;
  is_active: boolean;
};

export type PprMonthPlan = {
  id: string;
  object_id: string;
  system_id: string;
  plan_month: string;
  generated_at: string;
};

export type PprMonthPlanItem = {
  id: string;
  object_id: string;
  month_plan_id: string;
  system_id: string;
  subsystem_id: string;
  equipment_id: string;
  assignment_id: string;
  template_id: string;
  planned_for: string;
  source_due_date: string;
  is_overdue: boolean;
  is_carried_over: boolean;
  task_id: string | null;
  status: PprMonthPlanItemStatus;
};

export type PprTask = {
  id: string;
  object_id: string;
  system_id: string;
  subsystem_id: string;
  equipment_id: string;
  responsible_user_id: string;
  assignee_id: string | null;
  planned_for: string;
  completed_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  status: PprTaskStatus;
  is_overdue: boolean;
  is_rescheduled: boolean;
  general_comment: string | null;
  cancel_reason: string | null;
  created_at?: string;
};

export type PprTaskWorkItem = {
  id: string;
  object_id: string;
  task_id: string;
  assignment_id: string;
  template_id: string;
  plan_item_id: string | null;
  title_snapshot: string;
  description_snapshot: string | null;
  methodology_snapshot: string | null;
  checklist_snapshot: Array<{
    sort_order: number;
    title: string;
    description: string | null;
  }>;
  norm_hours_snapshot: number | null;
  sort_order: number;
};

export type PprTaskComment = {
  id: string;
  object_id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: { full_name: string } | Array<{ full_name: string }> | null;
};

export type PprTaskAttachment = {
  id: string;
  object_id: string;
  task_id: string;
  comment_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
  url?: string | null;
};

export type PprActor = {
  id: string;
  role: Role;
  accessibleObjectIds?: string[];
};
