const fs = require("fs");
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
  taskIds: [],
};
const results = [];

function record(name, ok, details = "") {
  results.push({ name, ok, details });
  const prefix = ok ? "PASS" : "FAIL";
  console.log(`${prefix} ${name}${details ? ` :: ${details}` : ""}`);
}

async function createAuthUser(label, role) {
  const email = `task-matrix.${NOW}.${label}@example.com`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw error ?? new Error(`Не удалось создать user ${label}`);
  }

  created.authUserIds.push(data.user.id);
  const { error: profileError } = await service.from("profiles").insert({
    id: data.user.id,
    full_name: `TASK MATRIX ${label}`,
    role,
  });
  if (profileError) throw profileError;

  return {
    id: data.user.id,
    email,
    password: PASSWORD,
    role,
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

async function insertObject(actorId, objectEngineerId) {
  const { data, error } = await service
    .from("objects")
    .insert({
      name: `TASK MATRIX OBJ ${NOW}`,
      created_by: actorId,
      object_engineer_id: objectEngineerId,
    })
    .select("id")
    .single();
  if (error) throw error;
  created.objectIds.push(data.id);
  return data.id;
}

async function linkUserToObject(userId, objectId) {
  const { error } = await service.from("user_objects").insert({ user_id: userId, object_id: objectId });
  if (error) throw error;
}

async function createTask(client, actorId, objectId, assignedTo, title) {
  const { data, error } = await client
    .from("tasks")
    .insert({
      title,
      description: "task assignment matrix smoke",
      object_id: objectId,
      status: "new",
      priority: "medium",
      created_by: actorId,
      assigned_to: assignedTo,
    })
    .select("id")
    .single();
  if (error) {
    return { ok: false, details: error.message };
  }
  created.taskIds.push(data.id);
  return { ok: true, id: data.id };
}

async function addTeamMember(client, taskId, userId, actorId) {
  const { error } = await client.from("task_team_members").insert({
    task_id: taskId,
    user_id: userId,
    added_by: actorId,
  });
  if (error) {
    return { ok: false, details: error.message };
  }
  return { ok: true };
}

async function reassignTask(client, taskId, assignedTo) {
  const { error } = await client.from("tasks").update({ assigned_to: assignedTo }).eq("id", taskId);
  if (error) {
    return { ok: false, details: error.message };
  }
  return { ok: true };
}

async function buildAssignableCandidatesForActor(engineerClient, actor, objectId) {
  const allowedRoles = ["lead", "engineer", "object_engineer", "tech"];
  const { data: candidates, error: candidatesError } = await engineerClient
    .from("profiles")
    .select("id,role")
    .in("role", allowedRoles);
  if (candidatesError) throw candidatesError;

  const { data: actorLinks, error: actorLinksError } = await engineerClient
    .from("user_objects")
    .select("object_id")
    .eq("user_id", actor.id);
  if (actorLinksError) throw actorLinksError;

  const actorObjectIds = [...new Set((actorLinks ?? []).map((row) => row.object_id))];
  const candidateIds = (candidates ?? []).map((row) => row.id);

  const [{ data: linkedObjects, error: linkedObjectsError }, { data: ownedObjects, error: ownedObjectsError }] =
    await Promise.all([
      service.from("user_objects").select("user_id,object_id").in("user_id", candidateIds).in("object_id", actorObjectIds),
      service.from("objects").select("id,object_engineer_id").in("object_engineer_id", candidateIds).eq("id", objectId),
    ]);
  if (linkedObjectsError) throw linkedObjectsError;
  if (ownedObjectsError) throw ownedObjectsError;

  const objectIdsByUser = new Map();
  for (const row of linkedObjects ?? []) {
    const current = objectIdsByUser.get(row.user_id) ?? new Set();
    current.add(row.object_id);
    objectIdsByUser.set(row.user_id, current);
  }
  for (const row of ownedObjects ?? []) {
    if (!row.object_engineer_id) continue;
    const current = objectIdsByUser.get(row.object_engineer_id) ?? new Set();
    current.add(row.id);
    objectIdsByUser.set(row.object_engineer_id, current);
  }

  return (candidates ?? []).filter((candidate) => {
    if (candidate.role === "lead") return true;
    return objectIdsByUser.get(candidate.id)?.has(objectId) ?? false;
  });
}

async function cleanup() {
  if (created.taskIds.length) {
    await service.from("tasks").delete().in("id", created.taskIds);
  }
  if (created.objectIds.length) {
    await service.from("objects").delete().in("id", created.objectIds);
  }
  if (created.authUserIds.length) {
    await service.from("user_objects").delete().in("user_id", created.authUserIds);
    await service.from("profiles").delete().in("id", created.authUserIds);
    for (const userId of created.authUserIds) {
      await service.auth.admin.deleteUser(userId).catch(() => undefined);
    }
  }
}

async function main() {
  const users = {
    engineerActor: await createAuthUser("engineer-actor", "engineer"),
    leadActor: await createAuthUser("lead-actor", "lead"),
    targetEngineer: await createAuthUser("target-engineer", "engineer"),
    targetLead: await createAuthUser("target-lead", "lead"),
    targetTech: await createAuthUser("target-tech", "tech"),
    targetObjectEngineer: await createAuthUser("target-object-engineer", "object_engineer"),
  };

  const objectId = await insertObject(users.leadActor.id, users.targetObjectEngineer.id);
  await linkUserToObject(users.engineerActor.id, objectId);
  await linkUserToObject(users.targetEngineer.id, objectId);
  await linkUserToObject(users.targetTech.id, objectId);

  const engineerClient = await signIn(users.engineerActor);
  const leadClient = await signIn(users.leadActor);

  const visibleCandidates = await buildAssignableCandidatesForActor(engineerClient, users.engineerActor, objectId);
  const visibleCandidateIds = new Set(visibleCandidates.map((candidate) => candidate.id));
  record("engineer sees target engineer candidate", visibleCandidateIds.has(users.targetEngineer.id));
  record("engineer sees target lead candidate", visibleCandidateIds.has(users.targetLead.id));

  const engineerAssignedTask = await createTask(
    engineerClient,
    users.engineerActor.id,
    objectId,
    users.targetEngineer.id,
    `TASK MATRIX engineer->engineer ${NOW}`
  );
  record("engineer creates task for engineer", engineerAssignedTask.ok, engineerAssignedTask.details ?? "");

  const leadAssignedTask = await createTask(
    engineerClient,
    users.engineerActor.id,
    objectId,
    users.targetLead.id,
    `TASK MATRIX engineer->lead ${NOW}`
  );
  record("engineer creates task for lead", leadAssignedTask.ok, leadAssignedTask.details ?? "");

  if (engineerAssignedTask.ok) {
    const teamAddResult = await addTeamMember(
      engineerClient,
      engineerAssignedTask.id,
      users.targetEngineer.id,
      users.engineerActor.id
    );
    record("engineer adds engineer to team", teamAddResult.ok, teamAddResult.details ?? "");
  } else {
    record("engineer adds engineer to team", false, "task seed missing");
  }

  const leadOwnedTask = await createTask(
    leadClient,
    users.leadActor.id,
    objectId,
    users.targetTech.id,
    `TASK MATRIX reassignment ${NOW}`
  );
  if (leadOwnedTask.ok) {
    const reassignmentResult = await reassignTask(leadClient, leadOwnedTask.id, users.targetEngineer.id);
    record("lead reassigns task to engineer", reassignmentResult.ok, reassignmentResult.details ?? "");
  } else {
    record("lead reassigns task to engineer", false, leadOwnedTask.details ?? "task seed missing");
  }

  const failed = results.filter((result) => !result.ok).length;
  console.log(`SUMMARY passed=${results.length - failed} failed=${failed}`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("FAIL task assignment matrix smoke", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
  });
