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
    <article className="section-card grid" style={{ gap: "0.85rem", padding: "1rem" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
        <div className="grid" style={{ gap: "0.2rem" }}>
          <strong style={{ fontSize: "1rem" }}>{profile.full_name}</strong>
          <span className="text-soft">{ROLE_LABELS[profile.role]}</span>
        </div>
        <span className="text-soft" style={{ fontSize: "0.82rem" }}>
          {template ? `v${template.version}` : "Нет шаблона"}
        </span>
      </div>

      <div className="grid" style={{ gap: "0.3rem" }}>
        <span>{template?.name ?? "Персональный чек-лист еще не создан"}</span>
        <span className="text-soft" style={{ fontSize: "0.88rem" }}>
          {template
            ? `Пунктов: ${itemCount}${template.description ? " • есть описание" : ""}`
            : "Создайте первый активный шаблон для этого сотрудника."}
        </span>
      </div>

      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <span className="text-soft" style={{ fontSize: "0.82rem" }}>
          {template ? "Откроется редактирование активной версии" : "Откроется создание нового шаблона"}
        </span>
        <button className="btn btn-accent" type="button" onClick={onOpen}>
          {template ? "Открыть" : "Создать"}
        </button>
      </div>
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

  useEffect(() => {
    setName(template?.name ?? `${targetProfile.full_name} — ежедневный чек-лист`);
    setDescription(template?.description ?? "");
    setItems(template?.items?.length ? template.items.map(toEditorItem) : [defaultItem()]);
  }, [targetProfile.full_name, template]);

  const versionLabel = useMemo(
    () => (template ? `Активная версия: ${template.version}` : "Новый шаблон"),
    [template]
  );

  function updateItem(index: number, patch: Partial<EditorItem>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((current) => [...current, defaultItem()]);
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

  return (
    <form className="grid" style={{ gap: "1rem" }} onSubmit={submit}>
      <input type="hidden" name="profile_id" value={targetProfile.id} />

      <div className="section-card grid" style={{ gap: "1rem", padding: "1.25rem" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <div className="grid" style={{ gap: "0.2rem" }}>
            <span className="text-soft" style={{ fontSize: "0.82rem" }}>
              {mode === "create" ? "Создание шаблона" : "Редактирование шаблона"}
            </span>
            <strong style={{ fontSize: "1.1rem" }}>{targetProfile.full_name}</strong>
            <span className="text-soft">{ROLE_LABELS[targetProfile.role]}</span>
            <span className="text-soft">{versionLabel}</span>
          </div>
          <button className="btn btn-ghost" type="button" onClick={onBack}>
            К списку шаблонов
          </button>
        </div>

        <div className="grid" style={{ gap: "0.75rem" }}>
          <label className="grid" style={{ gap: "0.35rem" }}>
            <span className="text-soft">Название шаблона</span>
            <input className="input" name="name" value={name} onChange={(event) => setName(event.target.value)} />
          </label>

          <label className="grid" style={{ gap: "0.35rem" }}>
            <span className="text-soft">Описание</span>
            <textarea
              className="input"
              name="description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="grid" style={{ gap: "1rem" }}>
        {items.map((item, index) => (
          <div key={`${targetProfile.id}-${index}`} className="section-card" style={{ padding: "1.25rem" }}>
            <div className="grid" style={{ gap: "1rem" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <strong style={{ fontSize: "1.05rem" }}>Пункт {index + 1}</strong>
                <button className="btn btn-ghost" type="button" onClick={() => removeItem(index)} disabled={pending}>
                  Удалить
                </button>
              </div>

              <div className="grid" style={{ gap: "0.75rem" }}>
                <input
                  className="input"
                  name="item_title"
                  placeholder="Что проверить (краткое название)"
                  value={item.title}
                  onChange={(event) => updateItem(index, { title: event.target.value })}
                />
                <textarea
                  className="input"
                  name="item_description"
                  rows={2}
                  placeholder="Подсказка или критерий проверки"
                  value={item.description}
                  onChange={(event) => updateItem(index, { description: event.target.value })}
                />
              </div>

              <div className="grid" style={{ gap: "0.75rem", background: "color-mix(in srgb, var(--panel-soft) 40%, transparent)", padding: "1rem", borderRadius: "var(--radius)" }}>
                <label className="grid" style={{ gap: "0.35rem" }}>
                  <span className="text-soft" style={{ fontSize: "0.85rem" }}>
                    Тип расписания
                  </span>
                  <select
                    className="select"
                    name="item_schedule_type"
                    value={item.scheduleType}
                    onChange={(event) => updateItem(index, { scheduleType: event.target.value as EditorItem["scheduleType"] })}
                  >
                    <option value="daily">Ежедневно</option>
                    <option value="weekday">День недели</option>
                    <option value="month_days">Список дней месяца</option>
                    <option value="month_range">Диапазон дней месяца</option>
                  </select>
                </label>

                {item.scheduleType !== "weekday" ? (
                  <input type="hidden" name="item_weekday" value={item.weekday} />
                ) : null}

                {item.scheduleType !== "month_days" ? (
                  <input type="hidden" name="item_month_days" value={item.monthDays} />
                ) : null}

                {item.scheduleType !== "month_range" ? (
                  <>
                    <input type="hidden" name="item_range_start" value={item.rangeStart} />
                    <input type="hidden" name="item_range_end" value={item.rangeEnd} />
                  </>
                ) : null}

                {item.scheduleType === "weekday" ? (
                  <label className="grid" style={{ gap: "0.35rem" }}>
                    <span className="text-soft" style={{ fontSize: "0.85rem" }}>
                      День недели
                    </span>
                    <select
                      className="select"
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
                  </label>
                ) : null}

                {item.scheduleType === "month_days" ? (
                  <label className="grid" style={{ gap: "0.35rem" }}>
                    <span className="text-soft" style={{ fontSize: "0.85rem" }}>
                      Дни месяца через запятую
                    </span>
                    <input
                      className="input"
                      name="item_month_days"
                      placeholder="02,05,08,11"
                      value={item.monthDays}
                      onChange={(event) => updateItem(index, { monthDays: event.target.value })}
                    />
                  </label>
                ) : null}

                {item.scheduleType === "month_range" ? (
                  <div className="grid" style={{ gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
                    <label className="grid" style={{ gap: "0.35rem" }}>
                      <span className="text-soft" style={{ fontSize: "0.85rem" }}>
                        От (день)
                      </span>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={31}
                        name="item_range_start"
                        value={item.rangeStart}
                        onChange={(event) => updateItem(index, { rangeStart: event.target.value })}
                      />
                    </label>
                    <label className="grid" style={{ gap: "0.35rem" }}>
                      <span className="text-soft" style={{ fontSize: "0.85rem" }}>
                        До (день)
                      </span>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={31}
                        name="item_range_end"
                        value={item.rangeEnd}
                        onChange={(event) => updateItem(index, { rangeEnd: event.target.value })}
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="row" style={{ gap: "1.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                <label className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    name="item_is_required"
                    value={String(index)}
                    checked={item.isRequired}
                    onChange={(event) => updateItem(index, { isRequired: event.target.checked })}
                  />
                  Обязательный пункт
                </label>

                <label className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    name="item_allow_task_escalation"
                    value={String(index)}
                    checked={item.allowTaskEscalation}
                    onChange={(event) => updateItem(index, { allowTaskEscalation: event.target.checked })}
                  />
                  Разрешить создание задачи
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
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
  const [selectedProfileId, setSelectedProfileId] = useState("");

  const templateByProfile = useMemo(
    () => new Map(templates.map((template) => [template.profile_id, template])),
    [templates]
  );
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const filteredProfiles = useMemo(
    () => profiles.filter((profile) => profileMatchesQuery(profile, searchQuery)),
    [profiles, searchQuery]
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
          <div className="section-card grid" style={{ gap: "0.85rem", padding: "1rem" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <div className="grid" style={{ gap: "0.2rem" }}>
                <strong style={{ fontSize: "1rem" }}>Все персональные шаблоны</strong>
                <span className="text-soft">Откройте существующий шаблон сотрудника или создайте новый персональный чек-лист.</span>
              </div>
              <button className="btn btn-accent" type="button" onClick={startCreate}>
                Создать новый чек-лист
              </button>
            </div>

            <label className="grid" style={{ gap: "0.35rem" }}>
              <span className="text-soft">Поиск по сотрудникам</span>
              <input
                className="input"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Введите ФИО или роль..."
              />
            </label>
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
            <div className="section-card grid" style={{ gap: "0.75rem", padding: "1rem" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <div className="grid" style={{ gap: "0.2rem" }}>
                  <strong style={{ fontSize: "1rem" }}>Создать новый чек-лист</strong>
                  <span className="text-soft">Сначала выберите сотрудника, для которого будет создан персональный шаблон.</span>
                </div>
                <button className="btn btn-ghost" type="button" onClick={backToDirectory}>
                  К списку шаблонов
                </button>
              </div>

              <label className="grid" style={{ gap: "0.35rem" }}>
                <span className="text-soft">Сотрудник</span>
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
