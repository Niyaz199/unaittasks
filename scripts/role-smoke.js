const fs = require("fs");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

function loadEnv() {
  const content = fs.readFileSync(".env", "utf8");
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

const env = loadEnv();
const NOW = Date.now();
const PASSWORD = "SmokePass!2026";
const TODAY = new Date().toISOString().slice(0, 10);

function dayOffset(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function createAnonClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const created = {
  authUserIds: [],
  objectIds: [],
  roomIds: [],
  taskIds: [],
  taskCommentIds: [],
  pprSystemIds: [],
  pprEquipmentIds: [],
  pprTaskIds: [],
  pprCommentIds: [],
  roundsCheckinIds: [],
};

const results = [];

function record(name, ok, details = "") {
  results.push({ name, ok, details });
  const prefix = ok ? "PASS" : "FAIL";
  console.log(`${prefix} ${name}${details ? ` :: ${details}` : ""}`);
}

async function expect(name, fn) {
  try {
    const outcome = await fn();
    if (outcome === true) {
      record(name, true);
      return;
    }
    if (typeof outcome === "object" && outcome) {
      record(name, Boolean(outcome.ok), outcome.details ?? "");
      return;
    }
    record(name, Boolean(outcome), "");
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
  }
}

async function createAuthUser(label, role = null) {
  const email = `smoke.${NOW}.${label}@example.com`;
  const fullName = `SMOKE ${label}`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw error ?? new Error(`Не удалось создать auth user ${label}`);
  }
  created.authUserIds.push(data.user.id);

  if (role) {
    const { error: profileError } = await service.from("profiles").insert({
      id: data.user.id,
      full_name: fullName,
      role,
    });
    if (profileError) throw profileError;
  }

  return {
    id: data.user.id,
    email,
    password: PASSWORD,
    role,
    fullName,
  };
}

async function signIn(user) {
  const client = createAnonClient();
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw error;
  return client;
}

async function insertRows(table, rows) {
  const { data, error } = await service.from(table).insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

async function selectExists(client, table, id) {
  const { data, error } = await client.from(table).select("id").eq("id", id).maybeSingle();
  if (error) return { ok: false, details: error.message };
  return { ok: Boolean(data) };
}

async function insertTaskComment(client, taskId, authorId, body) {
  const { data, error } = await client
    .from("task_comments")
    .insert({ task_id: taskId, author_id: authorId, body, client_msg_id: crypto.randomUUID() })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, details: error.message };
  if (data?.id) created.taskCommentIds.push(data.id);
  return { ok: Boolean(data?.id) };
}

async function insertPprComment(client, taskId, objectId, authorId, body) {
  const { data, error } = await client
    .from("ppr_task_comments")
    .insert({ task_id: taskId, object_id: objectId, author_id: authorId, body })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, details: error.message };
  if (data?.id) created.pprCommentIds.push(data.id);
  return { ok: Boolean(data?.id) };
}

async function deleteTask(client, taskId) {
  const { data, error } = await client.from("tasks").delete().eq("id", taskId).select("id");
  if (error) return { ok: false, details: error.message };
  return { ok: Array.isArray(data) && data.length === 1 };
}

async function updateProfile(client, userId, patch) {
  const { data, error } = await client.from("profiles").update(patch).eq("id", userId).select("id");
  if (error) return { ok: false, details: error.message };
  return { ok: Array.isArray(data) && data.length === 1 };
}

async function insertUserObject(client, userId, objectId) {
  const { data, error } = await client
    .from("user_objects")
    .insert({ user_id: userId, object_id: objectId })
    .select("user_id");
  if (error) return { ok: false, details: error.message };
  return { ok: Array.isArray(data) && data.length === 1 };
}

async function insertProfile(client, userId, fullName, role) {
  const { data, error } = await client
    .from("profiles")
    .insert({ id: userId, full_name: fullName, role })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, details: error.message };
  return { ok: Boolean(data?.id) };
}

async function deleteProfile(client, userId) {
  const { data, error } = await client.from("profiles").delete().eq("id", userId).select("id");
  if (error) return { ok: false, details: error.message };
  return { ok: Array.isArray(data) && data.length === 1 };
}

async function insertObject(client, actorId, name, objectEngineerId = null) {
  const { data, error } = await client
    .from("objects")
    .insert({ name, created_by: actorId, object_engineer_id: objectEngineerId })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, details: error.message };
  if (data?.id) created.objectIds.push(data.id);
  return { ok: Boolean(data?.id), id: data?.id };
}

async function insertRoom(client, objectId, name) {
  const { data, error } = await client
    .from("object_rooms")
    .insert({ object_id: objectId, name, floor: "1", is_active: true, rounds_enabled: true })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, details: error.message };
  if (data?.id) created.roomIds.push(data.id);
  return { ok: Boolean(data?.id), id: data?.id };
}

async function saveRoundsConfig(client, objectId, roomIds) {
  const { error } = await client.rpc("rounds_save_room_selection", {
    _object_id: objectId,
    _enabled_room_ids: roomIds,
  });
  if (error) return { ok: false, details: error.message };
  return { ok: true };
}

async function insertRoundsCheckin(client, roomId, objectId, userId, displayName) {
  const { data, error } = await client
    .from("rounds_checkins")
    .insert({
      operational_date: TODAY,
      room_id: roomId,
      object_id: objectId,
      checked_in_by_user_id: userId,
      checked_in_by_display_name: displayName,
      scanned_at_device: new Date().toISOString(),
      client_event_id: crypto.randomUUID(),
      source: "smoke",
      comment: "smoke rounds checkin",
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, details: error.message };
  if (data?.id) created.roundsCheckinIds.push(data.id);
  return { ok: Boolean(data?.id) };
}

async function main() {
  const users = {
    admin: await createAuthUser("admin", "admin"),
    chief: await createAuthUser("chief", "chief"),
    lead: await createAuthUser("lead", "lead"),
    engineer: await createAuthUser("engineer", "engineer"),
    objectEngineer: await createAuthUser("object-engineer", "object_engineer"),
    tech: await createAuthUser("tech", "tech"),
    targetTech: await createAuthUser("target-tech", "tech"),
    targetEngineer: await createAuthUser("target-engineer", "engineer"),
    targetLead: await createAuthUser("target-lead", "lead"),
    blankForEngineer: await createAuthUser("blank-for-engineer"),
    blankForObjectEngineer: await createAuthUser("blank-for-object-engineer"),
  };

  const [{ id: objectA }, { id: objectB }] = await insertRows("objects", [
    {
      name: `SMOKE OBJ A ${NOW}`,
      created_by: users.admin.id,
      object_engineer_id: users.objectEngineer.id,
    },
    {
      name: `SMOKE OBJ B ${NOW}`,
      created_by: users.admin.id,
      object_engineer_id: users.chief.id,
    },
  ]);
  created.objectIds.push(objectA, objectB);

  const rooms = await insertRows("object_rooms", [
    { object_id: objectA, name: `SMOKE ROOM A ${NOW}`, floor: "1", is_active: true, rounds_enabled: true },
    { object_id: objectB, name: `SMOKE ROOM B ${NOW}`, floor: "1", is_active: true, rounds_enabled: true },
  ]);
  const roomA = rooms[0].id;
  const roomB = rooms[1].id;
  created.roomIds.push(roomA, roomB);

  await insertRows("user_objects", [
    { user_id: users.engineer.id, object_id: objectA },
    { user_id: users.tech.id, object_id: objectA },
  ]);

  const tasks = await insertRows("tasks", [
    {
      title: `SMOKE lead own ${NOW}`,
      description: "smoke",
      object_id: objectA,
      status: "new",
      priority: "medium",
      created_by: users.lead.id,
      assigned_to: users.tech.id,
    },
    {
      title: `SMOKE engineer assigned ${NOW}`,
      description: "smoke",
      object_id: objectA,
      status: "new",
      priority: "medium",
      created_by: users.lead.id,
      assigned_to: users.engineer.id,
    },
    {
      title: `SMOKE foreign ${NOW}`,
      description: "smoke",
      object_id: objectB,
      status: "new",
      priority: "medium",
      created_by: users.chief.id,
      assigned_to: users.chief.id,
    },
    {
      title: `SMOKE delete lead ${NOW}`,
      description: "smoke",
      object_id: objectA,
      status: "new",
      priority: "medium",
      created_by: users.lead.id,
      assigned_to: users.lead.id,
    },
    {
      title: `SMOKE delete chief ${NOW}`,
      description: "smoke",
      object_id: objectB,
      status: "new",
      priority: "medium",
      created_by: users.chief.id,
      assigned_to: users.chief.id,
    },
  ]);
  const taskLeadOwn = tasks[0].id;
  const taskEngineerAssigned = tasks[1].id;
  const taskForeign = tasks[2].id;
  const taskDeleteLead = tasks[3].id;
  const taskDeleteChief = tasks[4].id;
  created.taskIds.push(...tasks.map((item) => item.id));

  const { data: groupRow, error: groupError } = await service.from("ppr_system_groups").select("id").limit(1).single();
  if (groupError) throw groupError;

  const systems = await insertRows("ppr_systems", [
    {
      object_id: objectA,
      system_group_id: groupRow.id,
      name: `SMOKE PPR SYS A ${NOW}`,
      responsible_user_id: users.engineer.id,
      is_active: true,
    },
    {
      object_id: objectB,
      system_group_id: groupRow.id,
      name: `SMOKE PPR SYS B ${NOW}`,
      responsible_user_id: users.lead.id,
      is_active: true,
    },
  ]);
  const systemA = systems[0].id;
  const systemB = systems[1].id;
  created.pprSystemIds.push(systemA, systemB);

  const equipment = await insertRows("ppr_equipment", [
    {
      object_id: objectA,
      system_id: systemA,
      room_id: roomA,
      inventory_no: `SMOKE-EQ-A-${NOW}`,
      name: `SMOKE PPR EQ A ${NOW}`,
      dispatch_name: `SMOKE PPR EQ A ${NOW}`,
      service_start_date: TODAY,
      status: "active",
    },
    {
      object_id: objectB,
      system_id: systemB,
      room_id: roomB,
      inventory_no: `SMOKE-EQ-B-${NOW}`,
      name: `SMOKE PPR EQ B ${NOW}`,
      dispatch_name: `SMOKE PPR EQ B ${NOW}`,
      service_start_date: TODAY,
      status: "active",
    },
  ]);
  const equipmentA = equipment[0].id;
  const equipmentB = equipment[1].id;
  created.pprEquipmentIds.push(equipmentA, equipmentB);

  const pprTasks = await insertRows("ppr_tasks", [
    {
      object_id: objectA,
      system_id: systemA,
      equipment_id: equipmentA,
      responsible_user_id: users.engineer.id,
      assignee_id: users.tech.id,
      planned_for: dayOffset(0),
      status: "new",
      is_overdue: false,
      is_rescheduled: false,
      general_comment: "smoke tech task",
    },
    {
      object_id: objectA,
      system_id: systemA,
      equipment_id: equipmentA,
      responsible_user_id: users.lead.id,
      assignee_id: users.lead.id,
      planned_for: dayOffset(1),
      status: "new",
      is_overdue: false,
      is_rescheduled: false,
      general_comment: "smoke lead task",
    },
    {
      object_id: objectA,
      system_id: systemA,
      equipment_id: equipmentA,
      responsible_user_id: users.lead.id,
      assignee_id: users.objectEngineer.id,
      planned_for: dayOffset(2),
      status: "new",
      is_overdue: false,
      is_rescheduled: false,
      general_comment: "smoke oe task",
    },
    {
      object_id: objectB,
      system_id: systemB,
      equipment_id: equipmentB,
      responsible_user_id: users.lead.id,
      assignee_id: users.lead.id,
      planned_for: dayOffset(3),
      status: "new",
      is_overdue: false,
      is_rescheduled: false,
      general_comment: "smoke foreign task",
    },
  ]);
  const pprTaskTech = pprTasks[0].id;
  const pprTaskLead = pprTasks[1].id;
  const pprTaskOe = pprTasks[2].id;
  const pprTaskForeign = pprTasks[3].id;
  created.pprTaskIds.push(...pprTasks.map((item) => item.id));

  const clients = {
    admin: await signIn(users.admin),
    chief: await signIn(users.chief),
    lead: await signIn(users.lead),
    engineer: await signIn(users.engineer),
    objectEngineer: await signIn(users.objectEngineer),
    tech: await signIn(users.tech),
  };

  await expect("lead sees own task", async () => selectExists(clients.lead, "tasks", taskLeadOwn));
  await expect("lead does not see foreign task pool", async () => {
    const result = await selectExists(clients.lead, "tasks", taskForeign);
    return { ok: !result.ok, details: result.details };
  });
  await expect("engineer sees assigned task", async () => selectExists(clients.engineer, "tasks", taskEngineerAssigned));
  await expect("engineer does not see unrelated task of own object", async () => {
    const result = await selectExists(clients.engineer, "tasks", taskLeadOwn);
    return { ok: !result.ok, details: result.details };
  });
  await expect("object_engineer sees all tasks of owner object", async () => selectExists(clients.objectEngineer, "tasks", taskEngineerAssigned));
  await expect("object_engineer does not see foreign object task", async () => {
    const result = await selectExists(clients.objectEngineer, "tasks", taskForeign);
    return { ok: !result.ok, details: result.details };
  });
  await expect("tech sees assigned task", async () => selectExists(clients.tech, "tasks", taskLeadOwn));
  await expect("tech does not see unassigned task", async () => {
    const result = await selectExists(clients.tech, "tasks", taskEngineerAssigned);
    return { ok: !result.ok, details: result.details };
  });

  await expect("engineer can add task comment", async () =>
    insertTaskComment(clients.engineer, taskEngineerAssigned, users.engineer.id, `smoke engineer comment ${NOW}`)
  );
  await expect("object_engineer can add task comment on owner object task", async () =>
    insertTaskComment(clients.objectEngineer, taskLeadOwn, users.objectEngineer.id, `smoke oe comment ${NOW}`)
  );
  await expect("tech can add task comment on assigned task", async () =>
    insertTaskComment(clients.tech, taskLeadOwn, users.tech.id, `smoke tech comment ${NOW}`)
  );

  await expect("lead can delete accessible task", async () => deleteTask(clients.lead, taskDeleteLead));
  await expect("engineer cannot delete task", async () => {
    const result = await deleteTask(clients.engineer, taskEngineerAssigned);
    return { ok: !result.ok, details: result.details };
  });
  await expect("object_engineer cannot delete task", async () => {
    const result = await deleteTask(clients.objectEngineer, taskLeadOwn);
    return { ok: !result.ok, details: result.details };
  });
  await expect("chief can delete task globally", async () => deleteTask(clients.chief, taskDeleteChief));

  await expect("lead can update user profile", async () =>
    updateProfile(clients.lead, users.targetEngineer.id, { full_name: `SMOKE lead updated ${NOW}`, role: "engineer" })
  );
  await expect("engineer can update only tech", async () =>
    updateProfile(clients.engineer, users.targetTech.id, { full_name: `SMOKE eng updated ${NOW}`, role: "tech" })
  );
  await expect("engineer cannot update engineer target", async () => {
    const result = await updateProfile(clients.engineer, users.targetEngineer.id, {
      full_name: `SMOKE denied ${NOW}`,
      role: "engineer",
    });
    return { ok: !result.ok, details: result.details };
  });
  await expect("object_engineer can update engineer target", async () =>
    updateProfile(clients.objectEngineer, users.targetEngineer.id, {
      full_name: `SMOKE oe updated ${NOW}`,
      role: "engineer",
    })
  );
  await expect("object_engineer cannot update lead target", async () => {
    const result = await updateProfile(clients.objectEngineer, users.targetLead.id, {
      full_name: `SMOKE oe denied ${NOW}`,
      role: "lead",
    });
    return { ok: !result.ok, details: result.details };
  });
  await expect("engineer can grant tech own object access", async () =>
    insertUserObject(clients.engineer, users.targetTech.id, objectA)
  );
  await expect("engineer cannot grant tech foreign object access", async () => {
    const result = await insertUserObject(clients.engineer, users.targetTech.id, objectB);
    return { ok: !result.ok, details: result.details };
  });
  await expect("object_engineer can grant engineer owner object access", async () =>
    insertUserObject(clients.objectEngineer, users.targetEngineer.id, objectA)
  );
  await expect("object_engineer cannot grant foreign object access", async () => {
    const result = await insertUserObject(clients.objectEngineer, users.targetEngineer.id, objectB);
    return { ok: !result.ok, details: result.details };
  });
  await expect("engineer can create manageable user profile row", async () =>
    insertProfile(clients.engineer, users.blankForEngineer.id, `SMOKE create by engineer ${NOW}`, "tech")
  );
  await expect("object_engineer can create engineer profile row", async () =>
    insertProfile(clients.objectEngineer, users.blankForObjectEngineer.id, `SMOKE create by oe ${NOW}`, "engineer")
  );
  await expect("engineer can delete manageable user profile row", async () => deleteProfile(clients.engineer, users.blankForEngineer.id));

  await expect("lead can create object", async () => insertObject(clients.lead, users.lead.id, `SMOKE lead object ${NOW}`));
  await expect("engineer cannot create object", async () => {
    const result = await insertObject(clients.engineer, users.engineer.id, `SMOKE eng object ${NOW}`);
    return { ok: !result.ok, details: result.details };
  });
  await expect("object_engineer cannot create object", async () => {
    const result = await insertObject(clients.objectEngineer, users.objectEngineer.id, `SMOKE oe object ${NOW}`);
    return { ok: !result.ok, details: result.details };
  });
  await expect("admin can create object", async () => insertObject(clients.admin, users.admin.id, `SMOKE admin object ${NOW}`));

  await expect("lead reads global PPR task", async () => selectExists(clients.lead, "ppr_tasks", pprTaskForeign));
  await expect("engineer reads PPR task of own object", async () => selectExists(clients.engineer, "ppr_tasks", pprTaskTech));
  await expect("engineer cannot read foreign PPR task", async () => {
    const result = await selectExists(clients.engineer, "ppr_tasks", pprTaskForeign);
    return { ok: !result.ok, details: result.details };
  });
  await expect("object_engineer reads owner-object PPR task", async () => selectExists(clients.objectEngineer, "ppr_tasks", pprTaskTech));
  await expect("tech reads only assigned PPR task", async () => selectExists(clients.tech, "ppr_tasks", pprTaskTech));
  await expect("tech cannot read foreign PPR task", async () => {
    const result = await selectExists(clients.tech, "ppr_tasks", pprTaskLead);
    return { ok: !result.ok, details: result.details };
  });
  await expect("lead can comment assigned PPR task", async () =>
    insertPprComment(clients.lead, pprTaskLead, objectA, users.lead.id, `smoke lead ppr comment ${NOW}`)
  );
  await expect("engineer can comment responsible PPR task", async () =>
    insertPprComment(clients.engineer, pprTaskTech, objectA, users.engineer.id, `smoke engineer ppr comment ${NOW}`)
  );
  await expect("engineer cannot comment unrelated PPR task in own object", async () => {
    const result = await insertPprComment(clients.engineer, pprTaskLead, objectA, users.engineer.id, `smoke denied ${NOW}`);
    return { ok: !result.ok, details: result.details };
  });
  await expect("object_engineer can comment only assigned PPR task", async () =>
    insertPprComment(clients.objectEngineer, pprTaskOe, objectA, users.objectEngineer.id, `smoke oe ppr comment ${NOW}`)
  );
  await expect("object_engineer cannot comment unrelated PPR task", async () => {
    const result = await insertPprComment(
      clients.objectEngineer,
      pprTaskTech,
      objectA,
      users.objectEngineer.id,
      `smoke oe denied ${NOW}`
    );
    return { ok: !result.ok, details: result.details };
  });
  await expect("tech can comment assigned PPR task", async () =>
    insertPprComment(clients.tech, pprTaskTech, objectA, users.tech.id, `smoke tech ppr comment ${NOW}`)
  );

  await expect("lead can save rounds config globally", async () => saveRoundsConfig(clients.lead, objectA, [roomA]));
  await expect("engineer can save rounds config in own scope", async () => saveRoundsConfig(clients.engineer, objectA, [roomA]));
  await expect("engineer cannot save rounds config outside own scope", async () => {
    const result = await saveRoundsConfig(clients.engineer, objectB, [roomB]);
    return { ok: !result.ok, details: result.details };
  });
  await expect("object_engineer can save rounds config for owner object", async () =>
    saveRoundsConfig(clients.objectEngineer, objectA, [roomA])
  );
  await expect("tech cannot save rounds config", async () => {
    const result = await saveRoundsConfig(clients.tech, objectA, [roomA]);
    return { ok: !result.ok, details: result.details };
  });
  await expect("tech can insert rounds checkin in scanner scope", async () =>
    insertRoundsCheckin(clients.tech, roomA, objectA, users.tech.id, users.tech.fullName)
  );

  await expect("engineer can read rooms of own object", async () => selectExists(clients.engineer, "object_rooms", roomA));
  await expect("engineer cannot read foreign rooms", async () => {
    const result = await selectExists(clients.engineer, "object_rooms", roomB);
    return { ok: !result.ok, details: result.details };
  });
  await expect("object_engineer can create room in owner object", async () =>
    insertRoom(clients.objectEngineer, objectA, `SMOKE OE room ${NOW}`)
  );
  await expect("engineer can create room in own object", async () => insertRoom(clients.engineer, objectA, `SMOKE ENG room ${NOW}`));
  await expect("tech cannot read rooms directory", async () => {
    const result = await selectExists(clients.tech, "object_rooms", roomA);
    return { ok: !result.ok, details: result.details };
  });

  const passed = results.filter((item) => item.ok).length;
  const failed = results.filter((item) => !item.ok).length;
  console.log(`SUMMARY passed=${passed} failed=${failed}`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

async function cleanup() {
  if (created.pprCommentIds.length) await service.from("ppr_task_comments").delete().in("id", created.pprCommentIds);
  if (created.taskCommentIds.length) await service.from("task_comments").delete().in("id", created.taskCommentIds);
  if (created.roundsCheckinIds.length) await service.from("rounds_checkins").delete().in("id", created.roundsCheckinIds);
  if (created.pprTaskIds.length) await service.from("ppr_tasks").delete().in("id", created.pprTaskIds);
  if (created.pprEquipmentIds.length) await service.from("ppr_equipment").delete().in("id", created.pprEquipmentIds);
  if (created.pprSystemIds.length) await service.from("ppr_systems").delete().in("id", created.pprSystemIds);
  if (created.taskIds.length) await service.from("tasks").delete().in("id", created.taskIds);
  if (created.roomIds.length) await service.from("object_rooms").delete().in("id", created.roomIds);
  if (created.objectIds.length) await service.from("objects").delete().in("id", created.objectIds);
  if (created.authUserIds.length) {
    await service.from("user_objects").delete().in("user_id", created.authUserIds);
    await service.from("profiles").delete().in("id", created.authUserIds);
    for (const userId of created.authUserIds) {
      await service.auth.admin.deleteUser(userId).catch(() => undefined);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
  });
