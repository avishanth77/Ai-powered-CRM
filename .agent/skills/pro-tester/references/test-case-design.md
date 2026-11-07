# Test Case Design

## Techniques
- **Equivalence partitioning**: group inputs into valid/invalid classes; test one per class.
- **Boundary value analysis**: min-1, min, min+1, max-1, max, max+1. Applies to lengths, numbers, dates, file sizes, list counts, pagination.
- **Decision table**: combine conditions → expected outcome (permissions, discounts, validation rules).
- **State transition**: draw states (e.g. Draft→Submitted→Approved→Rejected); test valid and invalid transitions.
- **Pairwise**: for many parameters (browser × OS × role), cover all pairs instead of all combinations.
- **Error guessing**: use the checklists below.

## Input checklist
Empty, null, whitespace only, very long, special chars (`' " < > & % \ /`), SQL/script injection strings, unicode/emoji/RTL, leading/trailing spaces, negative, zero, decimals, huge numbers, wrong type, duplicate, case sensitivity, future/past/leap dates, timezone edges.

## Functional checklist
Happy path; each validation rule; required vs optional fields; default values; save/cancel/back; refresh mid-flow; double-click/double-submit; concurrent edits; undo; search/filter/sort/pagination (empty, 1, many); CRUD each; data persists after reload.

## Auth & security checklist
Login/logout, wrong password, lockout, session expiry, back-button after logout, role-based access (horizontal & vertical privilege escalation), IDOR (change ID in URL/API), CSRF token, XSS in inputs/rendered output, SQLi, sensitive data in URLs/logs/responses, password reset flow, file upload type/size.

## UI/UX & compatibility
Responsive breakpoints, keyboard navigation, focus order, labels, error messages clarity, loading/empty/error states, browsers (Chrome, Firefox, Safari, Edge), mobile, accessibility basics (contrast, alt text, ARIA, screen reader).

## Non-functional
Performance (load time, N concurrent users), reliability (network drop, retry), localization, data migration, backup/restore, logging.

## Worked example – login form
| ID | Title | Steps | Expected | Type | Pri |
|---|---|---|---|---|---|
| TC-001 | Valid login | Enter valid email+password, submit | Redirect to dashboard; session created | Pos | P0 |
| TC-002 | Wrong password | Valid email, wrong password | Generic error "Invalid credentials"; no redirect | Neg | P0 |
| TC-003 | Empty fields | Submit blank | Inline required errors on both fields | Neg | P1 |
| TC-004 | Email boundary | 254 / 255 char email | 254 accepted/validated, 255 rejected | Edge | P2 |
| TC-005 | SQLi string | `' OR 1=1--` in email | Rejected; no auth bypass; no DB error shown | Neg | P0 |
| TC-006 | Lockout | 5 wrong attempts | Account locked/throttled per spec | Neg | P1 |
| TC-007 | Session after logout | Logout, press Back | Protected page not accessible | Neg | P1 |
