export type CalendarObjectOption = {
  id: string;
  name: string;
};

export type CalendarSystemGroupOption = {
  id: string;
  name: string;
  code: string;
};

export type CalendarSystemOption = {
  id: string;
  object_id: string;
  system_group_id: string;
  name: string;
  responsible_user_id: string | null;
  object: { name: string } | Array<{ name: string }> | null;
  system_group: { name: string; code: string } | Array<{ name: string; code: string }> | null;
};

export type BadgeTone = "neutral" | "info" | "warning" | "success" | "danger" | "violet";

export type MonthPlanRow = {
  id: string;
  object_id: string;
  system_id: string;
  plan_month: string;
  generated_at: string;
  object: { name: string } | Array<{ name: string }> | null;
  system: { name: string } | Array<{ name: string }> | null;
};

export type RoomRelation = {
  name: string;
  floor: string | null;
  floor_ref: { name: string; sort_order: number } | Array<{ name: string; sort_order: number }> | null;
  room_type: { name: string } | Array<{ name: string }> | null;
};

export type EquipmentRelation = {
  name: string;
  inventory_no: string | null;
  room: RoomRelation | Array<RoomRelation> | null;
};

export type MonthPlanTaskRelation =
  | { id: string; status: "new" | "in_progress" | "done" | "closed" | "cancelled"; planned_for: string }
  | Array<{ id: string; status: "new" | "in_progress" | "done" | "closed" | "cancelled"; planned_for: string }>
  | null;

export type MonthPlanItemRow = {
  id: string;
  object_id: string;
  month_plan_id: string;
  system_id: string;
  equipment_id: string;
  assignment_id: string;
  template_id: string;
  planned_for: string;
  source_due_date: string;
  is_overdue: boolean;
  is_carried_over: boolean;
  task_id: string | null;
  status: "pending" | "materialized" | "carried_over" | "closed" | "cancelled";
  month_plan: { plan_month: string } | Array<{ plan_month: string }> | null;
  equipment: EquipmentRelation | Array<EquipmentRelation> | null;
  template: { name: string; norm_hours: number | null } | Array<{ name: string; norm_hours: number | null }> | null;
  system: { name: string } | Array<{ name: string }> | null;
  object: { name: string } | Array<{ name: string }> | null;
  task: MonthPlanTaskRelation;
};

export type CalendarFilters = {
  year: number;
  month: string;
  objectId?: string;
  groupId?: string;
  systemId?: string;
};

export type FilterPatch = {
  year?: number;
  month?: string;
  objectId?: string | null;
  groupId?: string | null;
  systemId?: string | null;
  tab?: "year" | "month";
};

export type MonthDay = {
  isoDate: string;
  dayNumber: number;
  isWeekend: boolean;
};

export type DaySummary = {
  itemsCount: number;
  hours: number;
  hasOverdue: boolean;
  hasCarryover: boolean;
};

export type EquipmentMonthRow = {
  equipmentId: string;
  equipmentName: string;
  inventoryNo: string;
  roomName: string;
  itemsCount: number;
  hours: number;
  itemsByDate: Map<string, MonthPlanItemRow[]>;
};

export type MonthlyNotice = {
  tone: BadgeTone;
  message: string;
};

export type PendingMaterializedMove = {
  itemId: string;
  targetDate: string;
};
