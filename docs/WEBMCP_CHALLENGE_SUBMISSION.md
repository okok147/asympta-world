# WebMCP Challenge submission kit

Official source of truth: [Devpost overview](https://webmcp.devpost.com/) and [official rules](https://webmcp.devpost.com/rules). Recheck them immediately before submitting.

## Project title

**Asympta World — Humans live. Agents coordinate.**

## Tagline

A living coordination world where specialised agents expose safe WebMCP tools, exchange state across real stakeholder roles, and keep consequential decisions with the human.

## Short description

Asympta World is a living multi-stakeholder map built around WebMCP. A person chooses a real-world intent such as a custom order, current research, dinner coordination or service recovery. Specialised agents visibly move between roles while the same deterministic state is exposed through thirteen imperative WebMCP tools. Browser agents can read request and world state, submit a request for visible human review, inspect agents and request simulated actions, but consequential work stops at an explicit human approval boundary.

## Why WebMCP materially improves the product

The visual map is useful to humans, but a browser agent should not need to scrape map markers, reverse-engineer buttons or guess identifiers. Asympta World exposes structured capabilities directly from the page:

- stable workflow and agent identifiers;
- bounded JSON Schemas;
- compact live state instead of DOM scraping;
- direct requests that enter the same state engine as the visible UI;
- an inspectable human-approval boundary instead of hidden autonomous execution.

This makes the collaboration two-sided: the browser agent can understand and request work precisely, while the person can see what that request changed in the world and remains responsible for consequential approval.

## Current WebMCP implementation

The mounted challenge page directly calls `document.modelContext.registerTool(...)` and unregisters tools through an `AbortController` lifecycle. It also uses `getTools()` when available to audit the deployed registry.

### Core living-world tools

1. `asympta_observe_living_city` — read foreground workflow state and currently visible synthetic city actors.
2. `asympta_observe_global_supply_network` — read the bounded global simulation.
3. `asympta_list_workflows` — enumerate available workflow definitions.
4. `asympta_follow_agent` — change the local camera selection; correctly marked as a local write.
5. `asympta_request_workflow` — request a workflow start and queue visible human approval.
6. `asympta_request_external_action` — request a simulated consequential action and queue visible human approval.

### Discovery and verification tools

7. `asympta_describe_capabilities` — return the manifest, disclosure and safety rules.
8. `asympta_inspect_agent` — inspect one foreground stakeholder without returning map coordinates.
9. `asympta_get_pending_approval` — read pending approval without authority to resolve it.
10. `asympta_submit_request` — create a bounded request that waits for the person to review and send.
11. `asympta_read_request` — read only the exact request ID returned by submit.
12. `asympta_send_agent_message` — write a bounded structured message.
13. `asympta_list_agent_messages` — read bounded structured messages.

No registered WebMCP tool can approve or decline an approval. This is deliberate: the browser agent can prepare and request consequential work, but final consent stays in the visible human UI.

## Shared state architecture

The WebMCP calls are not a disconnected demo endpoint. The visible map and the tool layer share the same `AtlasWorldState`:

- workflow phase and dependency graph;
- ten stakeholder agents;
- moving/working/waiting status;
- inter-agent messages;
- workflow events;
- pending approvals;
- synthetic map positions;
- completion state.

The page also exposes a deterministic demo bridge for automated verification. WebMCP read helpers consume that same bridge, while core mutating tools call the same `requestWebMcpWorkflow` and `requestWebMcpAction` transitions used by the product.

## Safety and truthful simulation

- Supplier, payment, shipment, commerce and customer-update integrations are simulated in this challenge build.
- The map is a synthetic Tokyo demonstration world; the WebMCP surface does not request device geolocation.
- A WebMCP workflow request queues approval before the workflow starts.
- A consequential action request queues approval before the simulated action is accepted.
- The approval resolution is intentionally not exposed as a WebMCP tool.
- Tool arguments are constrained by enums, required fields, length bounds and `additionalProperties: false` where applicable.

## Public URLs

- Live product: <https://okok147.github.io/asympta-world/>
- Public source: <https://github.com/okok147/asympta-world>
- License: <https://github.com/okok147/asympta-world/blob/main/LICENSE>

No login or credentials are required.

## Judge testing instructions

### Fast human + browser-agent path

1. Open the live product.
2. Open Asympta's top-left access card to see the human-facing READ and WRITE REQUEST permissions.
3. In a WebMCP-capable browser, ask: `Describe what I can do in Asympta World.`
4. Ask: `Inspect agent-supplier and summarize what it is doing.`
5. Ask: `Request the custom-order workflow, but do not approve anything for me.`
6. Confirm the site enters a visible WebMCP human-approval card. The browser agent should not be able to resolve it itself.
7. Approve manually in Asympta. Watch the specialised agents move and coordinate.
8. Ask: `What human approval is pending now?` when a consequential checkpoint appears.
9. Request a simulated action such as capacity reservation and confirm it again stops at the visible approval boundary.

### Chrome WebMCP testing

1. Enable `chrome://flags/#enable-webmcp-testing` and relaunch Chrome.
2. Open the live product.
3. Use the browser's Model Context/WebMCP inspection surface.
4. Confirm all thirteen tool names in this document are registered.
5. Execute the three discovery/read tools and at least one core read tool.
6. Request `custom-order`; confirm a visible human approval is created.
7. Verify there is no WebMCP tool for approve/decline.

### Source and automated verification

```bash
npm ci
npm run lint
npm run typecheck
npm run test:webmcp
npm run test:engine
npm run build
npm run test:rendered
npm run export:pages
```

`tests/webmcp-contract.test.mjs` checks the exact thirteen-tool contract, Chrome `getTools()` schema shape, direct imperative API source use, abort lifecycle, access hints, safety invariants and documentation consistency.

## Suggested demo video — 2:30 to 2:50

| Time | Picture | Narration goal |
| --- | --- | --- |
| 0:00–0:15 | Living map with stakeholder agents | “The human sees a world, not a hidden automation transcript.” |
| 0:15–0:35 | Open the WebMCP access card | Explain the visible READ and WRITE REQUEST boundary. |
| 0:35–0:58 | Browser agent calls `asympta_describe_capabilities` and `asympta_inspect_agent` | Show actual native tool discovery and structured output. |
| 0:58–1:20 | Browser agent requests `custom-order` | Show the visible WebMCP approval card and state clearly that the agent cannot approve it. |
| 1:20–1:50 | Human approves; agents move through customer/business/supplier/finance/ops | Show visible multi-stakeholder coordination and information exchange. |
| 1:50–2:12 | A consequential checkpoint appears; call `asympta_get_pending_approval` | Demonstrate that the agent can understand the decision without gaining consent authority. |
| 2:12–2:32 | Human resolves checkpoint; map continues | Show the human-agent handoff completing safely. |
| 2:32–2:45 | Tool registry + public repo + MIT license | Prove WebMCP integration and open-source submission requirements. |

Record the deployed build. Make native WebMCP discovery and at least one successful tool execution visible in the video rather than showing only the in-product inspector.

## Judging-criteria proof

### WebMCP leverage

- Thirteen actually registered, purpose-specific imperative tools.
- Direct `document.modelContext.registerTool(...)` integration in mounted source.
- Structured JSON Schemas with bounded workflow, agent and action identifiers.
- Browser-registry audit through `getTools()` when available.
- Tool effects are visible in the same canonical world the human sees.
- Consequential requests cannot bypass the human approval boundary.

### Execution

- Four multi-stakeholder workflows and ten specialised stakeholder agents.
- Deterministic world state shared by UI, map and WebMCP.
- Automated WebMCP contract test plus existing engine/rendered-site tests.
- GitHub Pages deploy runs lint, typecheck, tests, build, rendered validation and static export before publication.
- English, Traditional Chinese and Japanese UI support in the mounted map experience.

### Potential impact

- Replaces fragile browser scraping with explicit capabilities for complex multi-party tasks.
- Lets agents carry structured coordination while people retain judgment and approval.
- Makes agent activity legible in a shared spatial interface instead of a hidden chain of calls.

### Creativity and ambition

- Treats the browser as a living coordination world rather than a conventional assistant panel.
- Makes multiple stakeholder agents, exchanges and approvals visible as spatial activity.
- Uses WebMCP as the actual control/observation contract, not merely as a badge or mock inspector.

## Final submission checklist

- [ ] Recheck entrant/team eligibility against the current official rules.
- [ ] Confirm the live URL is public and accessible without login.
- [ ] Test the deployed URL in ChatGPT's WebMCP-capable in-app browser or WebMCP-enabled Chrome.
- [ ] Confirm all thirteen native tools register on the deployed origin.
- [ ] Execute at least one read tool and one request tool on the deployed origin.
- [ ] Confirm the request creates the visible human approval boundary.
- [ ] Confirm there is no agent-accessible approval/decline tool.
- [ ] Confirm the public repository contains source, setup instructions and the visible MIT license.
- [ ] Record a fresh deployed-build demo with narration and visible native WebMCP execution.
- [ ] Keep the public demo video below the challenge time limit.
- [ ] Add the live URL, repository URL, description and video URL to the final Devpost entry.
- [ ] Recheck the official deadline and all rules immediately before submission.

## What is newly strengthened for challenge verification

The challenge build now keeps an explicit thirteen-tool WebMCP contract, request-scoped READ/WRITE tools, an in-page registry audit, automated schema/access/safety tests, and a visible human approval boundary. These additions share the deterministic living-world state rather than using a separate mock endpoint.
