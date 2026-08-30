# Asympta World Model

Asympta World is no longer limited to one city. The same calm map now supports two semantic scales:

- **World** — aggregate intercontinental supply, energy and logistics coordination.
- **City** — the existing Tokyo-level agent workflow and human approval detail.

The world model is a deterministic product simulation. It represents plausible batches, routes, capacity, cost, energy and coordination decisions; it does not claim to be live carrier, customs, power-market or commercial data.

## What is modelled

### Resources

- Food and cold-chain products
- Industrial materials
- Merchandise
- Medicine
- Electricity and dispatchable energy reserve

### Physical network

The graph includes farms, fisheries, mines, factories, ports, airports, warehouses, markets, cities and generation assets. Multi-leg flows use ocean vessels, aircraft, rail, freight trucks, delivery vans, local cars and power-grid corridors.

Examples include:

- Australian grain → Port Adelaide → Yokohama → Tokyo rail/DC → food market → local delivery
- Norwegian seafood → cold truck → Oslo air cargo → Narita → Tokyo cold chain
- Pilbara lithium → Shenzhen manufacturing → Hong Kong air cargo → Tokyo distribution
- Frankfurt medicine → air cargo → Narita → care delivery
- Qatar LNG reserve and Hokkaido wind → Tokyo grid balancing
- Shenzhen merchandise → Singapore transshipment → Los Angeles retail

### Agent coordination

Each flow has an explicit agent handoff chain: sourcing, supplier, factory, quality, port, customs, ocean/air/rail, warehouse, grid and last-mile agents. The simulation generates bounded coordination events for constraints, reroutes, cold-chain risk, congestion, inventory shortages and power balancing.

The active city workflow also changes the global focus automatically:

- Dinner → food network
- Order → materials network
- Launch → merchandise network
- Recovery → medicine network

## Performance invariants

The world model is deliberately bounded:

- One existing MapLibre map is reused; no second map or duplicate renderer is created.
- At most 48 shipment states exist in the current product simulation.
- At most 28 vehicle markers are rendered on desktop and 18 on mobile.
- Level of detail is semantic:
  - world overview: ship, air and grid
  - regional zoom: rail and freight truck are added
  - local zoom: van and car are added
- Marker coordinates can update every animation frame, while expensive work is throttled:
  - model step: 180 ms
  - map source refresh: 650 ms
  - viewport/LOD reconciliation: 900 ms
  - React UI projection: 600 ms
- Global route geometry is static and reused.
- City actors and schedule remain mounted but visually dormant in World mode, preserving fast scale switching and human approval safety.
- Runtime state has invariant checks for finite metrics, unique IDs, valid nodes/corridors, flow capacity and bounded inventory.

The key invariant is the same one used elsewhere in Asympta:

> Visual work must be bounded by what the user can currently understand, not by the total amount of simulated world state.

## Safety and truthfulness

World-scale actions are simulated. Human approval surfaces remain visible even in World mode. The global WebMCP tool is read-only and returns the simulation disclosure and invariant status alongside world state.
