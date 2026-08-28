import { readFile, writeFile } from "node:fs/promises";

async function patchEngine() {
  const path = "lib/living-world/engine.ts";
  let source = await readFile(path, "utf8");

  source = source.replace("const STEP_MS = 80;", "const STEP_MS = 60;");
  source = source.replace("const AGENT_SPEED_PER_MS = 0.0205;", "const AGENT_SPEED_PER_MS = 0.0088;");

  const spawnMatch = source.match(/const SPAWN_ARC: Point\[\] = \[[\s\S]*?\n\];/);
  if (!spawnMatch) throw new Error("SPAWN_ARC marker missing");
  if (!source.includes("const CITY_SPAWNS")) {
    source = source.replace(spawnMatch[0], `${spawnMatch[0]}\n\nconst CITY_SPAWNS: Record<string, Point> = {\n  \"order-conductor\": { x: 12, y: 70 },\n  \"order-receiver\": { x: 34, y: 45 },\n  \"order-merchandiser\": { x: 36, y: 47 },\n  \"order-warehouse\": { x: 44, y: 68 },\n  \"order-procurement\": { x: 35, y: 43 },\n  \"order-supplier\": { x: 70, y: 29 },\n  \"order-workshop\": { x: 51.5, y: 73.5 },\n  \"order-quality\": { x: 43, y: 22 },\n  \"order-fulfilment\": { x: 46, y: 70 },\n  \"order-finance\": { x: 58, y: 49 },\n  \"order-carrier\": { x: 87, y: 59 },\n  \"order-support\": { x: 24, y: 25 },\n};`);
  }
  source = source.replace("const base = SPAWN_ARC[index] ?? {", "const base = CITY_SPAWNS[profile.id] ?? SPAWN_ARC[index] ?? {");

  const moveRegex = /function moveAgent\(agent: LivingAgent, target: Point, deltaMs: number\) \{[\s\S]*?\n\}\n\nexport function locationContextForCoordinates/;
  if (!moveRegex.test(source)) throw new Error("moveAgent marker missing");
  source = source.replace(moveRegex, `function cityStreetWaypoint(agent: LivingAgent, target: Point): Point {\n  const horizontalFirst = [...agent.id].reduce((total, char) => total + char.charCodeAt(0), 0) % 2 === 0;\n  const dx = Math.abs(target.x - agent.position.x);\n  const dy = Math.abs(target.y - agent.position.y);\n  if (horizontalFirst && dx > 1.1) return { x: target.x, y: agent.position.y };\n  if (!horizontalFirst && dy > 1.1) return { x: agent.position.x, y: target.y };\n  if (dx > 1.1) return { x: target.x, y: agent.position.y };\n  if (dy > 1.1) return { x: agent.position.x, y: target.y };\n  return target;\n}\n\nfunction moveAgent(agent: LivingAgent, target: Point, deltaMs: number) {\n  const finalRemaining = distance(agent.position, target);\n  agent.target = target;\n  if (finalRemaining <= ARRIVAL_DISTANCE) {\n    agent.position = { ...target };\n    return true;\n  }\n\n  const waypoint = finalRemaining <= 2.2 ? target : cityStreetWaypoint(agent, target);\n  const dx = waypoint.x - agent.position.x;\n  const dy = waypoint.y - agent.position.y;\n  const segmentRemaining = Math.hypot(dx, dy);\n  if (segmentRemaining <= ARRIVAL_DISTANCE) {\n    agent.position = { ...waypoint };\n    return distance(agent.position, target) <= ARRIVAL_DISTANCE;\n  }\n\n  const travel = Math.min(segmentRemaining, AGENT_SPEED_PER_MS * deltaMs);\n  const nextX = agent.position.x + (dx / segmentRemaining) * travel;\n  const nextY = agent.position.y + (dy / segmentRemaining) * travel;\n  agent.facing = nextX < agent.position.x ? \"left\" : \"right\";\n  agent.position = { x: nextX, y: nextY };\n  return distance(agent.position, target) <= ARRIVAL_DISTANCE;\n}\n\nexport function locationContextForCoordinates`);

  if (!source.includes("function dependentRecipients")) {
    source = source.replace("function completeTask(world: LivingWorldState, task: AgentTask, agent: LivingAgent) {", `function dependentRecipients(world: LivingWorldState, task: AgentTask) {\n  const recipients = world.tasks\n    .filter((candidate) => candidate.dependencies.includes(task.id))\n    .map((candidate) => candidate.agentId)\n    .filter((id) => id !== task.agentId);\n  return [...new Set(recipients)];\n}\n\nfunction completeTask(world: LivingWorldState, task: AgentTask, agent: LivingAgent) {`);
  }

  source = source.replace(
    '    addMessage(world, agent.id, coordinatorId(world), task.completion, "result");',
    '    const recipients = dependentRecipients(world, task);\n    const targets = recipients.length ? recipients : [coordinatorId(world)];\n    for (const recipient of targets) addMessage(world, agent.id, recipient, task.completion, "result");',
  );

  await writeFile(path, source);
}

function patchTask(source, id, transform) {
  const regex = new RegExp(`\\{ id: \\\"${id}\\\"[\\s\\S]*?\\},\\n`);
  const match = source.match(regex);
  if (!match) throw new Error(`task ${id} missing`);
  return source.replace(match[0], transform(match[0]));
}

async function patchScenario() {
  const path = "lib/living-world/scenarios.ts";
  let source = await readFile(path, "utf8");

  source = source.replace('t("Business receiving", "商戶接單")', 't("Business receiving agent", "商戶接單 Agent")');
  source = source.replace('t("Turns a request into a traceable commercial job", "把需要轉成可追蹤商業工作")', 't("Acts for the store owner and turns an arrival into a traceable commercial job", "代表店主把到店需要轉成可追蹤商業工作")');

  source = patchTask(source, "customer-confirm", (block) => block
    .replace('title: t("Customer side confirms", "客戶一方確認")', 'title: t("Personal agent finds the store owner", "個人 Agent 找到店主")')
    .replace('thought: t("Answering without restarting the order", "不重啟訂單直接回答")', 'thought: t("Walking the request to Mori Paper Co.", "把需要帶到 Mori Paper Co.")')
    .replace('completion: t("Matte navy confirmed", "已確認啞面深藍")', 'completion: t("Owner reached · request handed to business agents", "已找到店主 · 需要交給商戶 Agent")')
    .replace('zone: "human"', 'zone: "communication"')
    .replace('dependencies: ["clarify"]', 'dependencies: ["interpret"]')
    .replace(', toolId: "order.clarify"', ''));

  source = patchTask(source, "business-receive", (block) => block
    .replace('dependencies: ["interpret"]', 'dependencies: ["customer-confirm"]'));

  source = patchTask(source, "clarify", (block) => block
    .replace('title: t("Clarify the finish", "釐清表面規格")', 'title: t("Business agents confirm the order", "商戶 Agent 確認訂單")')
    .replace('thought: t("Matte or gloss?", "啞面還是亮面？")', 'thought: t("Confirming finish, quantity and promise", "確認表面、數量與承諾")')
    .replace('completion: t("Question sent · matte requested", "問題已發出 · 要求啞面")', 'completion: t("Matte navy · 12 · Friday 17:00 confirmed", "啞面深藍 · 12 · 星期五 17:00 已確認")')
    .replace('dependencies: ["business-receive"], kind:', 'dependencies: ["business-receive"], toolId: "order.clarify", kind:'));

  await writeFile(path, source);
}

await patchEngine();
await patchScenario();
console.log("city-scale engine + order lifecycle patched");
