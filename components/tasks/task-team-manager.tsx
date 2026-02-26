"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TeamMembersPicker } from "@/components/tasks/team-members-picker";
import type { AssigneeOption } from "@/components/ui/assignee-combobox";

type Member = { user_id: string; full_name: string };

type Props = {
  taskId: string;
  canManage: boolean;
  currentUserId: string;
  assigneeId: string;
  initialMembers: Member[];
  allCandidates: Array<{ id: string; full_name: string; email?: string | null }>;
};

export function TaskTeamManager({ taskId, canManage, currentUserId, assigneeId, initialMembers, allCandidates }: Props) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const options: AssigneeOption[] = useMemo(
    () =>
      allCandidates.map((candidate) => ({
        id: candidate.id,
        label: candidate.full_name,
        subtitle: candidate.email ?? null
      })),
    [allCandidates]
  );

  const selectedIds = members.map((member) => member.user_id);
  const quickActions = [
    ...(currentUserId && currentUserId !== assigneeId ? [{ id: currentUserId, label: "Добавить себя" }] : []),
    ...(assigneeId ? [{ id: assigneeId, label: "Добавить ответственного" }] : [])
  ];

  function resolveNameById(userId: string) {
    return options.find((option) => option.id === userId)?.label ?? "Пользователь";
  }

  function addMember(userId: string) {
    if (!canManage || selectedIds.includes(userId)) return;
    startTransition(async () => {
      setMessage(null);
      const response = await fetch(`/api/tasks/${taskId}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setMessage(payload.error ?? "Не удалось добавить участника");
        return;
      }
      setMembers((prev) => [...prev, { user_id: userId, full_name: resolveNameById(userId) }]);
      router.refresh();
    });
  }

  function removeMember(userId: string) {
    if (!canManage) return;
    startTransition(async () => {
      setMessage(null);
      const response = await fetch(`/api/tasks/${taskId}/team`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setMessage(payload.error ?? "Не удалось удалить участника");
        return;
      }
      setMembers((prev) => prev.filter((member) => member.user_id !== userId));
      router.refresh();
    });
  }

  return (
    <div className="grid">
      <TeamMembersPicker
        options={options}
        selectedIds={selectedIds}
        onAdd={addMember}
        onRemove={removeMember}
        disabled={!canManage || pending}
        quickActions={quickActions}
        placeholder="Добавить участника (поиск по фамилии)"
      />
      {message ? <div className="text-soft">{message}</div> : null}
    </div>
  );
}
