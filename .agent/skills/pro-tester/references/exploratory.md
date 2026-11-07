# Exploratory Testing

**Charter format**: *Explore <area> with <resources/data/tools> to discover <risks/information>.*
Example: Explore checkout with expired cards and flaky network to discover payment-state inconsistencies.

Time-box 45–90 min. Take notes continuously: what was tried, what was observed, bugs, questions, ideas for later.

## Heuristics
- **SFDIPOT**: Structure, Function, Data, Interfaces, Platform, Operations, Time.
- **CRUD** on every entity. **Boundaries** on every input.
- **Goldilocks**: too big, too small, just right.
- **Interrupt**: refresh, back, close tab, lose network, switch app mid-flow.
- **Tours**: feature tour, money tour (revenue-critical), landmark tour, back-alley tour (rarely used features), saboteur tour (try to break it).

## Debrief
Coverage achieved, bugs found, blockers, areas needing scripted/automated follow-up.
