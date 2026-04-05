import type {
  DailyChecklistScheduleConfig,
  DailyChecklistScheduleType,
  DailyChecklistTemplateItem,
} from "@/lib/types";

type ScheduleDescriptor = Pick<
  DailyChecklistTemplateItem,
  "schedule_type" | "schedule_config" | "schedule_label"
>;

export function getDailyChecklistTimeZone() {
  return process.env.ROUND_PROJECT_TIMEZONE ?? process.env.TZ ?? "UTC";
}

export function toDailyChecklistOperationalDate(dateLike: Date | string, timeZone = getDailyChecklistTimeZone()) {
  const date = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function normalizeOperationalDate(value?: string | null, timeZone = getDailyChecklistTimeZone()) {
  if (!value) {
    return toDailyChecklistOperationalDate(new Date(), timeZone);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return toDailyChecklistOperationalDate(value, timeZone);
}

export function formatOperationalDateLabel(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("ru-RU");
}

export function weekdayLabel(weekday: number) {
  const labels = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
  return labels[weekday - 1] ?? "День недели";
}

export function buildScheduleLabel(type: DailyChecklistScheduleType, config: DailyChecklistScheduleConfig) {
  if (type === "daily") {
    return "Ежедневно";
  }
  if (type === "weekday") {
    return weekdayLabel(Number(config.weekday ?? 1));
  }
  if (type === "month_days") {
    const days = [...new Set((config.days ?? []).map(Number).filter((day) => day >= 1 && day <= 31))].sort((a, b) => a - b);
    return days.map((day) => String(day).padStart(2, "0")).join(",");
  }

  const startDay = Number(config.startDay ?? 1);
  const endDay = Number(config.endDay ?? startDay);
  return `${startDay}-${endDay} число`;
}

export function sanitizeScheduleConfig(
  type: DailyChecklistScheduleType,
  config: DailyChecklistScheduleConfig
): DailyChecklistScheduleConfig {
  if (type === "daily") {
    return {};
  }
  if (type === "weekday") {
    const weekday = Math.min(7, Math.max(1, Number(config.weekday ?? 1)));
    return { weekday };
  }
  if (type === "month_days") {
    const days = [...new Set((config.days ?? []).map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 31))]
      .sort((a, b) => a - b);
    return { days };
  }

  const startDay = Math.min(31, Math.max(1, Number(config.startDay ?? 1)));
  const endDay = Math.min(31, Math.max(1, Number(config.endDay ?? startDay)));
  return { startDay, endDay };
}

function parseOperationalDate(value: string) {
  const [yearRaw, monthRaw, dayRaw] = value.split("-").map(Number);
  const date = new Date(Date.UTC(yearRaw, monthRaw - 1, dayRaw));
  return {
    year: yearRaw,
    month: monthRaw,
    day: dayRaw,
    isoWeekday: ((date.getUTCDay() + 6) % 7) + 1,
  };
}

export function matchesDailyChecklistSchedule(
  type: DailyChecklistScheduleType,
  rawConfig: DailyChecklistScheduleConfig,
  operationalDate: string
) {
  const config = sanitizeScheduleConfig(type, rawConfig);
  const parsed = parseOperationalDate(operationalDate);

  if (type === "daily") {
    return true;
  }
  if (type === "weekday") {
    return parsed.isoWeekday === config.weekday;
  }
  if (type === "month_days") {
    return (config.days ?? []).includes(parsed.day);
  }

  const startDay = Number(config.startDay ?? 1);
  const endDay = Number(config.endDay ?? startDay);
  if (startDay <= endDay) {
    return parsed.day >= startDay && parsed.day <= endDay;
  }
  return parsed.day >= startDay || parsed.day <= endDay;
}

export function filterTemplateItemsForDate<T extends ScheduleDescriptor>(items: T[], operationalDate: string) {
  return items.filter((item) =>
    matchesDailyChecklistSchedule(item.schedule_type, item.schedule_config, operationalDate)
  );
}
