# SaaS Screen Patterns

## Dashboard
- Top: 3-5 KPI cards (value, delta, period). Below: 1-2 primary charts, then recent activity / tasks needing attention.
- Answer "what needs my attention now?" first. Date-range picker with sensible default. Every number drillable.
- Charts: line for trends, bar for comparison; avoid pie >5 slices; label axes, never color-only.

## Data table (most common SaaS component)
- Sticky header, sortable columns, column show/hide, right-align numbers, left-align text.
- Search + filters above; show active filter chips with "Clear all". Persist state in URL.
- Bulk select → contextual bulk action bar. Row actions in a "..." menu; row click opens detail.
- Pagination or infinite scroll with count ("1-25 of 312"). Density toggle for power users.
- States: skeleton rows, empty ("No contacts yet - Import or Add"), no-results ("No match - Clear filters"), error with Retry.

## Forms
- Single column; labels above fields; mark optional (not required) when most are required.
- Inline validation on blur, errors beside the field, summary at top for long forms. Preserve input on error.
- Smart defaults, input masks, autosave drafts for long forms. Primary action right/bottom, Cancel secondary.
- Multi-step wizard only when >7 fields or logically staged; show progress.

## Detail / record page
Header (name, status, primary actions) → tabs (Overview, Activity, Related, Files) → side panel for metadata. Activity timeline is chronological with actor + timestamp.

## Settings & permissions
Group: Profile, Workspace, Members & roles, Billing, Integrations, API keys, Security. Role matrix table. Show disabled features with an explanation/upgrade path, not hidden silently.

## Pricing & upgrade
3 tiers max, highlight recommended, monthly/annual toggle (show savings), feature comparison table, clear free-trial terms. Upgrade prompts appear in context of the blocked action.

## Notifications & feedback
Toast for low-stakes confirmation (auto-dismiss, with Undo), inline banner for persistent state, modal only for blocking decisions. Don't over-notify.

## Empty states
Illustration optional; always: what this is, why it's empty, one primary CTA, optional sample data/import.

## Destructive actions
Name the object and consequence in confirm dialog ("Delete 12 contacts? This can't be undone"). Prefer soft delete + Undo. Type-to-confirm only for irreversible, high-impact actions.

## Multi-tenant / collaboration
Workspace switcher, role badges, presence indicators, comments/@mentions, audit log, share dialog with permission levels.
