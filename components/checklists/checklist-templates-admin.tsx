"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDailyChecklistTemplateActionSafe } from "@/app/actions/daily-checklist-actions";
import { AssigneeCombobox, type AssigneeOption } from "@/components/ui/assignee-combobox";
import { useToast } from "@/components/ui/toast";
import type {
  DailyChecklistRole,
  DailyChecklistTemplate,
  DailyChecklistTemplateItem,
  DailyChecklistTemplateProfile,
} from "@/lib/types";

type EditorItem = {
  title: string;
  description: string;
  scheduleType: DailyChecklistTemplateItem["schedule_type"];
  weekday: string;
  monthDays: string;
  rangeStart: string;
  rangeEnd: string;
  isRequired: boolean;
  allowTaskEscalation: boolean;
};

type TemplateScreenMode = "directory" | "create" | "edit";

const ROLE_LABELS: Record<DailyChecklistRole, string> = {
  lead: "Ведущий инженер",
  engineer: "Инженер",
  object_engineer: "Инженер объекта",
};

function defaultItem(): EditorItem {
  return {
    title: "",
    description: "",
    scheduleType: "daily",
    weekday: "1",
    monthDays: "",
    rangeStart: "1",
    rangeEnd: "1",
    isRequired: true,
    allowTaskEscalation: true,
  };
}

function toEditorItem(item: DailyChecklistTemplateItem): EditorItem {
  return {
    title: item.title,
    description: item.description ?? "",
    scheduleType: item.schedule_type,
    weekday: String(item.schedule_config.weekday ?? 1),
    monthDays: (item.schedule_config.days ?? []).join(","),
    rangeStart: String(item.schedule_config.startDay ?? 1),
    rangeEnd: String(item.schedule_config.endDay ?? 1),
    isRequired: item.is_required,
    allowTaskEscalation: item.allow_task_escalation,
  };
}

function profileMatchesQuery(profile: DailyChecklistTemplateProfile, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return `${profile.full_name} ${ROLE_LABELS[profile.role]}`.toLowerCase().includes(normalized);
}

function TemplateDirectoryCard({
  profile,
  template,
  onOpen,
}: {
  profile: DailyChecklistTemplateProfile;
  template?: DailyChecklistTemplate;
  onOpen: () => void;
}) {
  const itemCount = template?.items?.length ?? 0;

  return (
    <article className="section-card row" style={{ gap: "1rem", padding: "1rem", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
      <div className="grid" style={{ gap: "0.2rem", flex: "1 1 200px" }}>
        <strong style={{ fontSize: "1.05rem" }}>{profile.full_name}</strong>
        <span className="text-soft" style={{ fontSize: "0.85rem" }}>{ROLE_LABELS[profile.role]}</span>
      </div>

      <div className="grid" style={{ gap: "0.2rem", flex: "2 1 250px" }}>
        {template ? (
          <>
            <div className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontWeight: 500, color: "var(--success)" }}>Шаблон активен</span>
              <span className="text-soft" style={{ fontSize: "0.85rem" }}>v{template.version} • {itemCount} пунктов</span>
            </div>
            {template.description ? (
              <span className="text-soft" style={{ fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {template.description}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-soft">Шаблона нет</span>
        )}
      </div>

      <button className={template ? "btn btn-ghost" : "btn btn-accent"} type="button" onClick={onOpen} style={{ minWidth: "100px" }}>
        {template ? "Открыть" : "Создать"}
      </button>
    </article>
  );
}

function TemplateProfileEditor({
  targetProfile,
  template,
  mode,
  onBack,
}: {
  targetProfile: DailyChecklistTemplateProfile;
  template?: DailyChecklistTemplate;
  mode: Exclude<TemplateScreenMode, "directory">;
  onBack: () => void;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(template?.name ?? `${targetProfile.full_name} — ежедневный чек-лист`);
  const [description, setDescription] = useState(template?.description ?? "");
  const [items, setItems] = useState<EditorItem[]>(template?.items?.length ? template.items.map(toEditorItem) : [defaultItem()]);

  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set([0]));

  useEffect(() => {
    setName(template?.name ?? `${targetProfile.full_name} — ежедневный чек-лист`);
    setDescription(template?.description ?? "");
    const initialItems = template?.items?.length ? template.items.map(toEditorItem) : [defaultItem()];
    setItems(initialItems);
    setExpandedItems(new Set(initialItems.map((_, i) => i)));
  }, [targetProfile.full_name, template]);

  function toggleItem(index: number) {
    setExpandedItems((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function updateItem(index: number, patch: Partial<EditorItem>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((current) => {
      const next = [...current, defaultItem()];
      setExpandedItems((exp) => new Set(exp).add(next.length - 1));
      return next;
    });
  }

  function removeItem(index: number) {
    setItems((current) => (current.length === 1 ? [defaultItem()] : current.filter((_, itemIndex) => itemIndex !== index)));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveDailyChecklistTemplateActionSafe(formData);
      if (!result.ok) {
        addToast(result.error, "error");
        return;
      }
      addToast("Шаблон сохранён как новая активная версия", "success");
      router.refresh();
      onBack();
    });
  }

  function handleBack() {
    if (confirm("Выйти без сохранения? Все несохраненные изменения будут потеряны.")) {
      onBack();
    }
  }

  return (
    <form className="grid" style={{ gap: "1rem" }} onSubmit={submit}>
      <input type="hidden" name="profile_id" value={targetProfile.id} />

      {/* Блок A. Контекст */}
      <div className="section-card grid" style={{ gap: "1rem", padding: "1.25rem" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
          <div className="grid" style={{ gap: "0.2rem" }}>
            <span className="text-soft" style={{ fontSize: "0.85rem" }}>
              {mode === "create" ? "Новый шаблон" : "Редактирование активной версии"}
            </span>
            <strong style={{ fontSize: "1.15rem" }}>{targetProfile.full_name}</strong>
            <span className="text-soft" style={{ fontSize: "0.9rem" }}>{ROLE_LABELS[targetProfile.role]}</span>
          </div>
          <button className="btn btn-ghost" type="button" onClick={handleBack}>
            Назад к списку
          </button>
        </div>
        <div className="row" style={{ gap: "0.5rem", alignItems: "center", background: "color-mix(in srgb, var(--info) 15%, transparent)", padding: "0.75rem", borderRadius: "var(--radius)" }}>
          <span style={{ fontSize: "1.2rem" }}>ℹ️</span>
          <span style={{ fontSize: "0.9rem", color: "var(--info)" }}>
            {template ? `Сохранение создаст новую активную версию (текущая: v${template.version}).` : "Сохранение создаст новую активную версию шаблона."}
          </span>
        </div>
      </div>

      {/* Блок B. Общие данные */}
      <div className="section-card grid" style={{ gap: "1rem", padding: "1.25rem" }}>
        <label className="grid" style={{ gap: "0.35rem" }}>
          <span className="text-soft" style={{ fontSize: "0.9rem" }}>Название шаблона</span>
          <input className="input" name="name" value={name} onChange={(event) => setName(event.target.value)} />
        </label>

        <label className="grid" style={{ gap: "0.35rem" }}>
          <span className="text-soft" style={{ fontSize: "0.9rem" }}>Описание</span>
          <textarea
            className="input"
            name="description"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
      </div>

      {/* Блок C. Пункты чек-листа */}
      <div className="grid" style={{ gap: "0.75rem" }}>
        {items.map((item, index) => {
          const isExpanded = expandedItems.has(index);
          const scheduleLabel = 
            item.scheduleType === "daily" ? "Каждый день" :
            item.scheduleType === "weekday" ? "По дням недели" :
            item.scheduleType === "month_days" ? "В определённые дни месяца" :
            "В диапазон дней месяца";

          return (
            <div key={`${targetProfile.id}-${index}`} className="section-card" style={{ padding: "1rem" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", cursor: "pointer" }} onClick={() => toggleItem(index)}>
                <div className="grid" style={{ gap: "0.2rem", flex: 1 }}>
                  <strong style={{ fontSize: "1.05rem" }}>Пункт {index + 1}{item.title ? `: ${item.title}` : ""}</strong>
                  {!isExpanded && (
                    <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap", fontSize: "0.85rem", color: "var(--text-soft)" }}>
                      <span>🕒 {scheduleLabel}</span>
                      {item.isRequired && <span style={{ color: "var(--danger)" }}>• Обязательный</span>}
                      {item.allowTaskEscalation && <span style={{ color: "var(--info)" }}>• Можно создать задачу</span>}
                    </div>
                  )}
                </div>
                <div className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
                  <button className="btn btn-ghost" type="button" onClick={(e) => { e.stopPropagation(); removeItem(index); }} disabled={pending} style={{ padding: "0.25rem 0.5rem", color: "var(--danger)" }}>
                    Удалить
                  </button>
                  <span style={{ fontSize: "1.2rem", transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
                </div>
              </div>

              {isExpanded && (
                <div className="grid" style={{ gap: "1.25rem", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
                  {/* Секция Основное */}
                  <div className="grid" style={{ gap: "0.75rem" }}>
                    <label className="grid" style={{ gap: "0.35rem" }}>
                      <span className="text-soft" style={{ fontSize: "0.85rem" }}>Название пункта</span>
                      <input
                        className="input"
                        name="item_title"
                        placeholder="Что проверить"
                        value={item.title}
                        onChange={(event) => updateItem(index, { title: event.target.value })}
                      />
                    </label>
                    <label className="grid" style={{ gap: "0.35rem" }}>
                      <span className="text-soft" style={{ fontSize: "0.85rem" }}>Описание / критерий проверки</span>
                      <textarea
                        className="input"
                        name="item_description"
                        rows={2}
                        placeholder="Подсказка для инженера"
                        value={item.description}
                        onChange={(event) => updateItem(index, { description: event.target.value })}
                      />
                    </label>
                  </div>

                  {/* Секция Когда показывать */}
                  <div className="grid" style={{ gap: "0.75rem" }}>
                    <strong style={{ fontSize: "0.95rem" }}>Когда показывать</strong>
                    <div className="row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
                      <select
                        className="select"
                        style={{ flex: "1 1 200px" }}
                        name="item_schedule_type"
                        value={item.scheduleType}
                        onChange={(event) => updateItem(index, { scheduleType: event.target.value as EditorItem["scheduleType"] })}
                      >
                        <option value="daily">Каждый день</option>
                        <option value="weekday">По дням недели</option>
                        <option value="month_days">В определённые дни месяца</option>
                        <option value="month_range">В диапазон дней месяца</option>
                      </select>

                      {item.scheduleType !== "weekday" ? (
                        <input type="hidden" name="item_weekday" value={item.weekday} />
                      ) : (
                        <select
                          className="select"
                          style={{ flex: "1 1 200px" }}
                          name="item_weekday"
                          value={item.weekday}
                          onChange={(event) => updateItem(index, { weekday: event.target.value })}
                        >
                          <option value="1">Понедельник</option>
                          <option value="2">Вторник</option>
                          <option value="3">Среда</option>
                          <option value="4">Четверг</option>
                          <option value="5">Пятница</option>
                          <option value="6">Суббота</option>
                          <option value="7">Воскресенье</option>
                        </select>
                      )}

                      {item.scheduleType !== "month_days" ? (
                        <input type="hidden" name="item_month_days" value={item.monthDays} />
                      ) : (
                        <div className="grid" style={{ flex: "2 1 300px", gap: "0.2rem" }}>
                          <input
                            className="input"
                            name="item_month_days"
                            placeholder="Например: 1, 15, 28"
                            value={item.monthDays}
                            onChange={(event) => updateItem(index, { monthDays: event.target.value })}
                          />
                          <span className="text-soft" style={{ fontSize: "0.75rem" }}>Укажите числа через запятую</span>
                        </div>
                      )}

                      {item.scheduleType !== "month_range" ? (
                        <>
                          <input type="hidden" name="item_range_start" value={item.rangeStart} />
                          <input type="hidden" name="item_range_end" value={item.rangeEnd} />
                        </>
                      ) : (
                        <div className="row" style={{ flex: "2 1 300px", gap: "0.5rem", alignItems: "center" }}>
                          <span className="text-soft">с</span>
                          <input
                            className="input"
                            type="number"
                            min={1}
                            max={31}
                            name="item_range_start"
                            value={item.rangeStart}
                            onChange={(event) => updateItem(index, { rangeStart: event.target.value })}
                            style={{ width: "80px" }}
                          />
                          <span className="text-soft">по</span>
                          <input
                            className="input"
                            type="number"
                            min={1}
                            max={31}
                            name="item_range_end"
                            value={item.rangeEnd}
                            onChange={(event) => updateItem(index, { rangeEnd: event.target.value })}
                            style={{ width: "80px" }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Секция Поведение */}
                  <div className="row" style={{ gap: "1.5rem", flexWrap: "wrap", paddingTop: "0.5rem" }}>
                    <label className="row" style={{ gap: "0.5rem", alignItems: "center", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        name="item_is_required"
                        value={String(index)}
                        checked={item.isRequired}
                        onChange={(event) => updateItem(index, { isRequired: event.target.checked })}
                      />
                      Обязательный пункт
                    </label>

                    <label className="row" style={{ gap: "0.5rem", alignItems: "center", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        name="item_allow_task_escalation"
                        value={String(index)}
                        checked={item.allowTaskEscalation}
                        onChange={(event) => updateItem(index, { allowTaskEscalation: event.target.checked })}
                      />
                      Можно создать задачу
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", position: "sticky", bottom: "1rem", background: "var(--bg)", padding: "1rem", borderRadius: "var(--radius)", boxShadow: "0 -4px 20px rgba(0,0,0,0.1)", zIndex: 10 }}>
        <button className="btn btn-ghost" type="button" onClick={addItem} disabled={pending}>
          + Добавить пункт
        </button>
        <button className="btn btn-accent" type="submit" disabled={pending}>
          {pending ? "Сохраняем..." : "Сохранить шаблон"}
        </button>
      </div>
    </form>
  );
}

export function ChecklistTemplatesAdmin({
  templates,
  profiles,
}: {
  templates: DailyChecklistTemplate[];
  profiles: DailyChecklistTemplateProfile[];
}) {
  const [screenMode, setScreenMode] = useState<TemplateScreenMode>("directory");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<DailyChecklistRole | "all">("all");
  const [selectedProfileId, setSelectedProfileId] = useState("");

  const templateByProfile = useMemo(
    () => new Map(templates.map((template) => [template.profile_id, template])),
    [templates]
  );
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const filteredProfiles = useMemo(
    () => profiles.filter((profile) => {
      if (selectedRole !== "all" && profile.role !== selectedRole) return false;
      return profileMatchesQuery(profile, searchQuery);
    }),
    [profiles, searchQuery, selectedRole]
  );

  const assigneeOptions: AssigneeOption[] = profiles.map((profile) => ({
    id: profile.id,
    label: profile.full_name,
    subtitle: ROLE_LABELS[profile.role],
  }));

  useEffect(() => {
    if (screenMode === "edit" && selectedProfileId && !selectedProfile) {
      setScreenMode("directory");
      setSelectedProfileId("");
    }
  }, [screenMode, selectedProfile, selectedProfileId]);

  function openEditor(profileId: string) {
    setSelectedProfileId(profileId);
    setScreenMode(templateByProfile.has(profileId) ? "edit" : "create");
  }

  function startCreate() {
    setSelectedProfileId("");
    setScreenMode("create");
  }

  function backToDirectory() {
    setScreenMode("directory");
  }

  return (
    <div className="grid" style={{ gap: "1rem" }}>
      {screenMode === "directory" ? (
        <>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
            <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap", flex: "1 1 300px" }}>
              <input
                className="input"
                style={{ flex: "1 1 200px" }}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Поиск по ФИО..."
              />
              <select 
                className="select" 
                style={{ flex: "0 0 auto", minWidth: "160px" }}
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as DailyChecklistRole | "all")}
              >
                <option value="all">Все роли</option>
                <option value="lead">Ведущий инженер</option>
                <option value="engineer">Инженер</option>
                <option value="object_engineer">Инженер объекта</option>
              </select>
            </div>
            
            <button className="btn btn-accent" type="button" onClick={startCreate} style={{ flex: "0 0 auto" }}>
              Новый шаблон
            </button>
          </div>

          {filteredProfiles.length ? (
            <div className="grid" style={{ gap: "0.85rem" }}>
              {filteredProfiles.map((profile) => (
                <TemplateDirectoryCard
                  key={profile.id}
                  profile={profile}
                  template={templateByProfile.get(profile.id)}
                  onOpen={() => openEditor(profile.id)}
                />
              ))}
            </div>
          ) : (
            <div className="section-card text-soft">По текущему поиску сотрудники не найдены.</div>
          )}
        </>
      ) : (
        <div className="grid" style={{ gap: "1rem" }}>
          {screenMode === "create" ? (
            <div className="section-card grid" style={{ gap: "1rem", padding: "1.25rem" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <strong style={{ fontSize: "1.1rem" }}>Для кого создаём шаблон</strong>
                <button className="btn btn-ghost" type="button" onClick={backToDirectory}>
                  К списку
                </button>
              </div>

              <label className="grid" style={{ gap: "0.35rem" }}>
                <AssigneeCombobox
                  name="profile_id_create_search"
                  options={assigneeOptions}
                  placeholder="Начните вводить ФИО или роль..."
                  defaultValue={selectedProfileId}
                  onSelectedIdChange={(id) => setSelectedProfileId(id)}
                />
              </label>
            </div>
          ) : null}

          {selectedProfile ? (
            <TemplateProfileEditor
              targetProfile={selectedProfile}
              template={templateByProfile.get(selectedProfile.id)}
              mode={screenMode}
              onBack={backToDirectory}
            />
          ) : screenMode === "create" ? (
            <div className="section-card text-soft">Выберите сотрудника, чтобы открыть форму создания шаблона.</div>
          ) : (
            <div className="section-card text-soft">Не удалось определить сотрудника для редактирования.</div>
          )}
        </div>
      )}
    </div>
  );
}
