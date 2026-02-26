export type Role = "admin" | "chief" | "lead" | "engineer" | "object_engineer" | "tech";
export type TaskStatus = "new" | "in_progress" | "paused" | "done";
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
