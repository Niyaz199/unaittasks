import { describe, expect, it } from "vitest";
import {
  buildScheduleLabel,
  filterTemplateItemsForDate,
  matchesDailyChecklistSchedule,
  sanitizeScheduleConfig,
} from "@/lib/daily-checklists/scheduler";

describe("daily checklist scheduler", () => {
  it("matches daily rules for any operational date", () => {
    expect(matchesDailyChecklistSchedule("daily", {}, "2026-04-05")).toBe(true);
  });

  it("matches weekday rules using ISO weekdays", () => {
    expect(matchesDailyChecklistSchedule("weekday", { weekday: 1 }, "2026-04-06")).toBe(true);
    expect(matchesDailyChecklistSchedule("weekday", { weekday: 1 }, "2026-04-07")).toBe(false);
  });

  it("matches a list of month days", () => {
    const config = sanitizeScheduleConfig("month_days", { days: [2, 5, 8, 11] });
    expect(matchesDailyChecklistSchedule("month_days", config, "2026-04-05")).toBe(true);
    expect(matchesDailyChecklistSchedule("month_days", config, "2026-04-06")).toBe(false);
    expect(buildScheduleLabel("month_days", config)).toBe("02,05,08,11");
  });

  it("matches month ranges inside the month and across month boundary", () => {
    expect(matchesDailyChecklistSchedule("month_range", { startDay: 20, endDay: 25 }, "2026-04-24")).toBe(true);
    expect(matchesDailyChecklistSchedule("month_range", { startDay: 20, endDay: 25 }, "2026-04-26")).toBe(false);

    expect(matchesDailyChecklistSchedule("month_range", { startDay: 25, endDay: 1 }, "2026-04-26")).toBe(true);
    expect(matchesDailyChecklistSchedule("month_range", { startDay: 25, endDay: 1 }, "2026-05-01")).toBe(true);
    expect(matchesDailyChecklistSchedule("month_range", { startDay: 25, endDay: 1 }, "2026-05-02")).toBe(false);
  });

  it("filters template items by operational date", () => {
    const items = [
      {
        schedule_type: "daily" as const,
        schedule_config: {},
        schedule_label: "Ежедневно",
      },
      {
        schedule_type: "weekday" as const,
        schedule_config: { weekday: 1 },
        schedule_label: "Понедельник",
      },
      {
        schedule_type: "month_days" as const,
        schedule_config: { days: [6] },
        schedule_label: "06",
      },
    ];

    const result = filterTemplateItemsForDate(items, "2026-04-06");
    expect(result).toHaveLength(3);
  });
});
