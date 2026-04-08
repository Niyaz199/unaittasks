import { describe, expect, it } from "vitest";
import { canAddTaskTeamMember } from "@/lib/access/tasks";

describe("task team access", () => {
  it("allows lead to add themselves to the team", () => {
    expect(
      canAddTaskTeamMember("lead", "lead", {
        objectEngineerScoped: true,
        isSelfAdd: true,
      })
    ).toBe(true);
  });

  it("allows chief to add the assignee even when roles match", () => {
    expect(
      canAddTaskTeamMember("chief", "chief", {
        objectEngineerScoped: true,
        isAssigneeAdd: true,
      })
    ).toBe(true);
  });

  it("keeps regular role-matrix restrictions for non-shortcut additions", () => {
    expect(
      canAddTaskTeamMember("lead", "lead", {
        objectEngineerScoped: true,
      })
    ).toBe(false);
    expect(
      canAddTaskTeamMember("lead", "engineer", {
        objectEngineerScoped: true,
      })
    ).toBe(true);
  });

  it("still limits object engineer shortcuts to own scoped objects", () => {
    expect(
      canAddTaskTeamMember("object_engineer", "object_engineer", {
        objectEngineerScoped: false,
        isSelfAdd: true,
      })
    ).toBe(false);
  });
});
