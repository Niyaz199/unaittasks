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
