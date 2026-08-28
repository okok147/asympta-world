# Asympta World

> Humans live. Agents coordinate the world around them.

[Live world](https://okok147.github.io/asympta-world/) · [Complete order flow](https://okok147.github.io/asympta-world/?demo=order)

Asympta World is a calm, human-centred coordination world. A person states one ordinary intention and specialised agents carry it across the real sides that need to cooperate: requester, business, merchandiser, warehouse, procurement, supplier, production, quality control, fulfilment, finance, carrier and after-sales.

The interface deliberately returns to the original Asympta language: warm paper, restrained graphite/sage/blue, fine grid, low-noise spatial composition, lightweight animal agents, generous spacing and progressive disclosure. It uses premium modern product design as a quality bar for clarity and finish without copying another company’s branding or layouts.

## Flagship flow

Open `?demo=order`, press **Order flow**, or type `/order`.

The simulated order is **12 customised matte-navy notebooks before Friday 17:00**. The canonical event engine moves through:

1. human intention packet;
2. business receiving;
3. merchandiser clarification;
4. customer confirmation without restarting the order;
5. inventory check: 8 available, shortage 4;
6. procurement contacts North Mill;
7. supplier quote, reserve, preparation and material handoff;
8. warehouse stock changes 8 → 12;
9. workshop scheduling and production;
10. quality control finds one defect;
11. rework and 12/12 release;
12. packing and invoice preparation;
13. **human approval boundary before simulated payment / dispatch**;
14. carrier handoff and simulated tracking;
15. delivery and after-sales support;
16. one compact result and audit trail returned to the person.

No merchant order, supplier purchase, payment, external message or shipment is real. All external adapters are labelled `SIMULATED` unless a real connector exists in a future version.

## Same world, same state

The visible UI, moving agents, task dependency graph, approval state, `render_game_to_text()` and WebMCP tools all read the same deterministic event state. The redesign does not replace the engine with a prerecorded animation.

Five narrow WebMCP tools remain available:

- `asympta_observe_coordination`
- `asympta_list_local_services`
- `asympta_submit_need`
- `asympta_exchange_information`
- `asympta_request_action`

Native WebMCP uses `document.modelContext.registerTool(...)`. Browsers without native support receive the same definitions through the explicitly labelled in-product compatibility bridge.

## Other scenarios

The same engine still supports Dinner, Work, Shopping and Email. These remain intentionally smaller examples; the Order flow is the flagship demonstration of a multi-party agent economy.

## Privacy and human judgment

- Exact coordinates are not rendered or returned through WebMCP.
- Device position is immediately grouped into a nearby poetic local area.
- Consequential actions stop for human approval.
- Current commerce, supplier, payment, production, inventory, carrier and tracking data is simulated.
- Reduced-motion and constrained devices keep the semantic product usable without progressive canvas effects.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

## Verify

```bash
npm run lint
npm run typecheck
npm run test:engine
npm run build
npm run test:rendered
npm run export:pages
```

GitHub Pages runs the same validation chain before deployment.
