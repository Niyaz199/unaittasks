import { describe, expect, it } from "vitest";
import {
  canAccessDailyChecklists,
  canManageDailyChecklistTemplates,
  canReadDailyChecklistControl,
  isDailyChecklistTemplateRole,
} from "@/lib/daily-checklists/access";

describe("daily checklist access", () => {
  it("allows only supported roles into the checklist module", () => {
    expect(canAccessDailyChecklists("engineer")).toBe(true);
    expect(canAccessDailyChecklists("chief")).toBe(true);
    expect(canAccessDailyChecklists("tech")).toBe(false);
  });

  it("limits template management to admin and chief", () => {
    expect(canManageDailyChecklistTemplates("admin")).toBe(true);
    expect(canManageDailyChecklistTemplates("chief")).toBe(true);
    expect(canManageDailyChecklistTemplates("lead")).toBe(false);
  });

  it("allows control view for management roles only", () => {
    expect(canReadDailyChecklistControl("lead")).toBe(true);
    expect(canReadDailyChecklistControl("engineer")).toBe(false);
  });

  it("recognizes only user checklist roles as template roles", () => {
    expect(isDailyChecklistTemplateRole("lead")).toBe(true);
    expect(isDailyChecklistTemplateRole("engineer")).toBe(true);
    expect(isDailyChecklistTemplateRole("object_engineer")).toBe(true);
    expect(isDailyChecklistTemplateRole("chief")).toBe(false);
  });
});
