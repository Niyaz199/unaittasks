export type Role = "admin" | "chief" | "lead" | "engineer" | "object_engineer" | "tech";
export type TaskStatus = "new" | "accepted" | "in_progress" | "paused" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export type Profile = {
  id: string;
  full_name: string;
  role: Role;
};

export type ObjectItem = {
  id: string;
  name: string;
  object_engineer_id?: string | null;
};

export type TaskTeamMember = {
  task_id: string;
  user_id: string;
  added_by: string | null;
  created_at: string;
  member?: { full_name: string } | null;
};

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  object_id: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  resume_at: string | null;
  created_at: string;
  created_by: string;
  assigned_to: string;
  accepted_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
  objects?: { name: string; object_engineer_id?: string | null } | null;
  assignee?: { full_name: string } | Array<{ full_name: string }> | null;
  team_members?: TaskTeamMember[] | null;
};

export type TaskHistoryEvent = {
  id: string;
  actor_id: string | null;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  meta: Record<string, unknown>;
  created_at: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  client_msg_id: string | null;
  author?: { full_name: string } | null;
};

export type TaskAttachment = {
  id: string;
  task_id: string;
  comment_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
  cleanup_after: string;
  deleted_at?: string | null;
  /** Поле добавляется на клиенте после получения signed URL */
  url?: string | null;
};

export type StockItemKind = "material" | "spare_part" | "consumable" | "component";
export type StockMovementType = "receipt" | "issue" | "adjustment_in" | "adjustment_out";
export type PurchaseRequestStatus = "new" | "in_progress" | "fulfilled" | "cancelled";

export type StockItem = {
  id: string;
  object_id: string;
  name: string;
  kind: StockItemKind;
  unit: string;
  sku: string | null;
  min_qty: number;
  current_qty: number;
  storage_location_id?: string | null;
  comment: string | null;
  is_active: boolean;
  created_at: string;
};

export type StockLocation = {
  id: string;
  object_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type PprSystemGroupRef = {
  id: string;
  name: string;
  code: string;
  is_active?: boolean;
};

export type StockItemSystemGroupLink = {
  id: string;
  object_id: string;
  stock_item_id: string;
  system_group_id: string;
  created_at: string;
};

export type PurchaseRequest = {
  id: string;
  object_id: string;
  status: PurchaseRequestStatus;
  source: "manual" | "low_stock";
  description: string | null;
  requested_by: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  fulfilled_at: string | null;
  cancelled_at: string | null;
};

export type DailyChecklistRole = Extract<Role, "lead" | "engineer" | "object_engineer">;
export type DailyChecklistTemplateStatus = "in_progress" | "completed";
export type DailyChecklistItemStatus = "pending" | "done" | "problem";
export type DailyChecklistScheduleType = "daily" | "weekday" | "month_days" | "month_range";

export type DailyChecklistScheduleConfig = {
  weekday?: number;
  days?: number[];
  startDay?: number;
  endDay?: number;
};

export type DailyChecklistTemplateItem = {
  id: string;
  template_id: string;
  sort_order: number;
  title: string;
  description: string | null;
  schedule_type: DailyChecklistScheduleType;
  schedule_config: DailyChecklistScheduleConfig;
  schedule_label: string;
  is_required: boolean;
  allow_task_escalation: boolean;
  created_at?: string;
};

export type DailyChecklistTemplate = {
  id: string;
  profile_id: string;
  profile_name: string;
  role: DailyChecklistRole;
  version: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  archived_at: string | null;
  items?: DailyChecklistTemplateItem[];
};

export type DailyChecklistAttachment = {
  id: string;
  item_run_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
  cleanup_after: string;
  deleted_at?: string | null;
  url?: string | null;
};

export type DailyChecklistItemRun = {
  id: string;
  run_id: string;
  operational_date?: string;
  template_item_id: string | null;
  sort_order: number;
  title: string;
  description: string | null;
  schedule_type: DailyChecklistScheduleType;
  schedule_config: DailyChecklistScheduleConfig;
  schedule_label: string;
  is_required: boolean;
  allow_task_escalation: boolean;
  status: DailyChecklistItemStatus;
  comment: string | null;
  linked_task_id: string | null;
  linked_object_id: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
  attachments?: DailyChecklistAttachment[];
};

export type DailyChecklistRun = {
  id: string;
  profile_id: string;
  role_snapshot: DailyChecklistRole;
  operational_date: string;
  template_id: string | null;
  template_name: string;
  status: DailyChecklistTemplateStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  items?: DailyChecklistItemRun[];
};

export type DailyChecklistDayData = {
  run: DailyChecklistRun | null;
  overdueItems: DailyChecklistItemRun[];
  completion: {
    total: number;
    completed: number;
    problems: number;
    requiredTotal: number;
    requiredResolved: number;
    percent: number;
  };
};

export type DailyChecklistControlRow = {
  run_id: string;
  profile_id: string;
  full_name: string;
  role: DailyChecklistRole;
  operational_date: string;
  status: DailyChecklistTemplateStatus;
  total_items: number;
  completed_items: number;
  problem_items: number;
  pending_required_items: number;
  linked_tasks: number;
};

export type DailyChecklistTemplateProfile = {
  id: string;
  full_name: string;
  role: DailyChecklistRole;
};
