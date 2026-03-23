export type RoundsObjectOption = {
  id: string;
  name: string;
};

export type RoundsScannerRoom = {
  room_id: string;
  object_id: string;
  object_name: string;
  room_name: string;
  floor_name: string;
  qr_token: string;
};

export type RoundsConfigRoom = {
  id: string;
  object_id: string;
  object_name: string;
  room_name: string;
  floor_name: string;
  is_active: boolean;
  rounds_enabled: boolean;
  rounds_qr_token: string | null;
  rounds_qr_generated_at: string | null;
};

export type RoundsTodayRow = {
  room_id: string;
  object_id: string;
  object_name: string;
  room_name: string;
  floor_name: string;
  rounds_enabled: boolean;
  status: "checked_in" | "missing";
  checked_in_at: string | null;
  checked_in_by: string | null;
  has_comment: boolean;
  has_photo: boolean;
  comment: string | null;
  photo_url: string | null;
};

export type RoundsArchiveRow = {
  id: string;
  operational_date: string;
  room_id: string;
  object_id: string;
  object_name: string;
  room_name: string;
  checked_in_by_user_id: string;
  checked_in_by_display_name: string;
  scanned_at_device: string;
  comment: string | null;
  photo_storage_path: string | null;
  photo_url: string | null;
};

export type RoundsQrResolution = {
  room_id: string;
  object_id: string;
  object_name: string;
  room_name: string;
  floor_name: string;
  qr_token: string;
};

export type RoundsCheckinResult = {
  id: string;
  operational_date: string;
  room_id: string;
  object_id: string;
  checked_in_by_user_id: string;
  checked_in_by_display_name: string;
  scanned_at_device: string;
  received_at_server: string;
  comment: string | null;
  photo_storage_path: string | null;
  photo_file_name: string | null;
  photo_mime_type: string | null;
  photo_size_bytes: number | null;
  client_event_id: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  was_applied: boolean;
  was_deduped: boolean;
};
