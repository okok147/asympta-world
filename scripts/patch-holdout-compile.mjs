import fs from "node:fs";

const path = "lib/asympta-kernel-holdout-benchmark.ts";
let source = fs.readFileSync(path, "utf8");
source = source.replace('import { runUniversalTask } from "./asympta-universal-task-protocol.ts";\n', "");
source = source.replace(
  /  if \(scenario\.family === "compound_truthfulness"\) \{[\s\S]*?\n  \}\n\n  const task = createCoreAsymptaTask\(\{/,
  `  if (scenario.family === "compound_truthfulness") {\n    const task = createCoreAsymptaTask({\n      taskId: scenario.id,\n      rootIntent: scenario.intent,\n      locale: scenario.locale,\n      domain: scenario.domain,\n      actionFamily: scenario.actionFamily,\n      mode: "simulated",\n      risk: "low",\n      missingFields: scenario.missingFields ?? [],\n    });\n    const unresolved = task.requirements.filter((requirement) => requirement.required\n      && !["resolved", "confirmed", "not_applicable"].includes(requirement.status));\n    const passed = task.result?.completed !== true\n      && unresolved.some((requirement) => requirement.key.includes("novel_constraint"));\n    return {\n      id: scenario.id,\n      family: scenario.family,\n      passed,\n      expected: scenario.expected,\n      observed: \`phase=\${task.phase}, completed=\${task.result?.completed ?? false}, unresolved=\${unresolved.map((requirement) => requirement.key).join(",")}\`,\n    };\n  }\n\n  const task = createCoreAsymptaTask({`,
);
fs.writeFileSync(path, source);
