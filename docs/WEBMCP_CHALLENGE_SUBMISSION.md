# WebMCP Challenge submission kit

Official source of truth: [Devpost overview](https://webmcp.devpost.com/) and [official rules](https://webmcp.devpost.com/rules). Recheck them immediately before submitting.

> **Eligibility warning checked August 28, 2026:** the current official rules explicitly exclude individuals resident in, and organizations domiciled in, Hong Kong and the other listed jurisdictions. Confirm that the actual entrant or team representative is eligible before entering; do not misstate residency or organization domicile.

## Project title

**Asympta World — Humans live. Agents coordinate.**

## Tagline

A living local world where specialised animal agents use WebMCP to divide everyday needs, exchange evidence, and return one useful outcome—while consequential actions stay with the human.

## Short description

Asympta World turns an ordinary human need into visible coordination. Type `/dinner`, `/work`, `/shopping`, or `/email`; a small, relevant team of distinct animal agents forms a real dependency graph, moves through a location-anchored world, calls provenance-labelled services, exchanges information, and converges on a concise result. Five imperative WebMCP tools let browser agents inspect and act through the same state machine. Booking, buying, sharing, and sending always stop for human approval.

## Long submission description

### Why this is a strong fit for WebMCP

Everyday tasks are not single clicks. Finding dinner can require location, preferences, discovery, hours, travel, and judgment. Preparing a meeting spans a calendar, research, documents, and unresolved questions. Without structured tools, an agent must scrape controls, guess state, and repeat fragile steps. Asympta World gives agents explicit, narrow capabilities to submit a need, observe coordination, discover relevant services, exchange information, and request a result action.

WebMCP does more than automate the existing interface here: it makes human-agent and agent-agent coordination part of the product. Tool calls enter the same deterministic event system as human actions, and their effects become visible in the world rather than disappearing into a hidden transcript.

### Better human experience

The person sees one clean world and one conversation field. `/` exposes every action without sending users through a large menu. Only useful agents appear. Their task graph, movement, service calls, information packets, and result are inspectable. The user can ignore the mechanics when they want a quick answer, or open context, progress, and WebMCP when they want control. The layout keeps the composer and critical buttons visible from a 320 px phone to a desktop.

### What people and agents can now do together

Agents can divide work, wait on dependencies, exchange bounded evidence, and converge without the human micromanaging each step. The human retains intent, privacy, and judgment: grouped location replaces exposed coordinates; provenance makes simulated data honest; and consequential actions move into a visible `waiting_for_human` state. This combines delegation with accountability in one shared spatial model.

### Implementation

The app registers five imperative tools through `document.modelContext.registerTool(...)`, each with a concise description, JSON Schema, validation, lifecycle cancellation, and annotation hints. Read tools return compact task and world state. Write tools create needs and visible information events. The result-action tool validates action IDs and can only request—not bypass—the in-product approval gate.

A typed deterministic engine owns phase, task dependencies, agents, messages, tool runs, results, and approvals. vGPU adds a single low-cost WebGPU coordination field on capable desktops at DPR 1 and 12 fps. Three.js renders the low-poly world and 3D animal presences. p5.js renders service pulses, travelling information packets, and completion celebration while avoiding duplicate ambient work when vGPU is active. All three are code-split, idle-loaded progressive layers behind shared screen-size, save-data, memory, reduced-motion, and capability gates; vGPU also pauses when the page is hidden. Semantic React controls and the DOM world remain the accessible, fully functional source for text and actions.

## Public URLs

- Live product: <https://okok147.github.io/asympta-world/>
- Instant dinner path: <https://okok147.github.io/asympta-world/?demo=dinner>
- Public source: <https://github.com/okok147/asympta-world>
- License: <https://github.com/okok147/asympta-world/blob/main/LICENSE>

No login or credentials are required.

## Testing instructions for judges

1. Open the instant dinner path and wait for the result, or type `/dinner`.
2. Select an animal to inspect its species, art style, role, competence, and current thought.
3. Open WebMCP. Invoke Observe coordination, List local services, and Exchange information.
4. At the result choose Reserve table. Confirm that the app enters a human approval dialog and states that no real booking will occur.
5. Approve the demo handoff and observe the celebration around the human.
6. Type `/shopping`, wait for the result, and request Buy this to verify the same approval boundary in another domain.
7. Open the menu to switch English / 繁中 and toggle camera follow.
8. Resize to mobile width and type `/`; the scrollable action chooser, composer, WebMCP button, and send button remain visible.

For Chrome 149 or later, enable `chrome://flags/#enable-webmcp-testing` and relaunch. The header changes from the honest compatible-fallback label to **WEBMCP LIVE** when native registration succeeds.

### Useful agent calls

```text
Observe the current coordination state.
List services relevant to this need and tell me which are simulated.
Submit a need: "Find me dinner nearby."
Exchange "Dietary context confirmed" from dinner-context to dinner-conductor.
Request the reserve-table action.
```

## 2:45 demo-video storyboard

The rules require a public YouTube video under three minutes with audio. Aim for 2:35–2:45 so upload/intro timing cannot push it over.

| Time | Picture | Narration goal |
| --- | --- | --- |
| 0:00–0:12 | Desktop idle world, composer in focus | “Most agent apps replace life with a chat. Asympta keeps the human in a living world.” |
| 0:12–0:28 | Type `/`; select Dinner | Show that every action is immediately reachable and only useful agents appear. |
| 0:28–0:58 | Agents divide tasks, move, call services | Name the dependency graph, distinct specialists, visible SIMULATED labels, subtle vGPU field, Three.js world, and p5 information packets. |
| 0:58–1:20 | Open progress/context; select two agents | Show inspectability without overwhelming the default view. |
| 1:20–1:50 | Open WebMCP; invoke Observe and Exchange | Explain imperative registration, schemas, annotations, and the shared event state. Keep the inspector/tool result visible. |
| 1:50–2:13 | Dinner result; Reserve table | Show one concise outcome and the `waiting_for_human` approval boundary. Say explicitly that nothing is booked in demo mode. |
| 2:13–2:29 | Approve; celebration around human | Close the loop: delegation, judgment, honest handoff, completion. |
| 2:29–2:39 | Phone viewport; `/` palette; 繁中 menu | Prove responsive and bilingual execution. |
| 2:39–2:45 | Four scenario buttons / closing thesis | “Humans live. Agents coordinate the world around them.” |

Use only original app visuals, spoken narration, and music you own or are licensed to use. Make the native WebMCP tool discovery clearly visible; do not rely only on the in-product fallback panel.

## Judging-criteria proof

### WebMCP leverage

- Five non-trivial, actually callable imperative tools.
- JSON Schema input bounds and current-state validation.
- Read-only and untrusted-content annotations.
- Native registration and abort lifecycle.
- Tool effects are visible in one canonical event world.
- Consequential tool requests cannot bypass human approval.

### Execution

- Four complete end-to-end needs and 17 distinct characters.
- Deterministic state engine, reproducible browser hooks, automated tests, server-render validation, and deployment workflow.
- Responsive layouts tested at 280×480, 320×568, 568×320, 844×390, 768×1024, 1024×600, and 1440×900.
- English default, 繁中 switch, keyboard slash navigation, focus styles, safe areas, and reduced motion.
- Honest modes, privacy-aware location grouping, and no fake external completion.

### Potential impact

- Addresses the real burden of coordinating ordinary cross-service needs.
- Lets agents handle parallel research while people keep intent and judgment.
- Makes delegation legible enough for less technical users.

### Creativity and ambition

- A spatial society of agents rather than a conventional assistant chat.
- Location becomes a poetic community without displaying exact coordinates.
- vGPU, Three.js, p5.js, WebMCP, and semantic UI project the same event state in complementary forms without making canvas the control surface.

## Final submission checklist

- [ ] Confirm entrant/team eligibility against the current official rules.
- [ ] Confirm the live URL is public, free, and works in ChatGPT's in-app browser and WebMCP-enabled Chrome.
- [ ] Confirm all five native tools register and execute on the deployed origin.
- [ ] Confirm the public repository contains source, setup instructions, and a visible MIT license.
- [ ] Record a fresh deployed-build demo with narration and visible WebMCP execution.
- [ ] Keep the YouTube video public and below 3:00.
- [ ] Avoid unlicensed music, third-party marks, secrets, personal coordinates, or private data.
- [ ] Add the live URL, repository URL, text description, and YouTube URL to Devpost.
- [ ] Submit before **September 3, 2026 at 1:00 PM PDT** and keep the tested project available through judging.
- [ ] Re-open the final Devpost entry and verify every link from a signed-out browser.

## What was newly built during the challenge window

The project was rebuilt into this human-need-driven WebMCP product during the challenge window: new event engine, five-tool WebMCP surface, approval model, responsive conversation-first UI, English/繁中 system, grouped geolocation world, 17-species character system, four scenario graphs, performance-gated vGPU field, Three.js environment, p5.js information/celebration layer, automated tests, and submission documentation. Earlier overlapping simulation UI is not mounted or shipped as the product surface.
