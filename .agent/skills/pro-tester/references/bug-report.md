# Bug Report

One bug per report. Reproducible by someone who has never seen the app.

```
Title: [Area] Short, specific symptom (not "Doesn't work")
ID:
Environment: App version/build, env (dev/staging/prod), OS, browser+version, device
Severity: Critical | Major | Minor | Trivial
Priority: P0 | P1 | P2 | P3
Preconditions: account/role, data state
Steps to reproduce:
  1.
  2.
  3.
Expected result:
Actual result:
Reproducibility: Always | Intermittent (x/10) | Once
Evidence: screenshot / video / console errors / network request+response / logs
Workaround: (if any)
Notes: suspected cause, related tickets, regression? (worked in build X)
```

## Severity guide
- **Critical**: crash, data loss, security hole, core flow blocked, no workaround.
- **Major**: key feature broken, workaround exists.
- **Minor**: non-core defect, cosmetic with function intact.
- **Trivial**: typo, alignment.

## Quality rules
- Minimize steps; remove anything not needed to reproduce.
- Attach evidence, don't just describe it.
- Facts only; no blame or opinion in the title.
- Search for duplicates first; retest the fix and verify on the same environment.
