# Secrets, Dependencies, Deployment

## Secrets
- Keep in environment variables / secret manager; load via `python-decouple` or `os.environ`.
- `.gitignore`: `.env`, `*.pem`, `*.key`, `db.sqlite3`, `media/`.
- **If a secret was committed**: 1) rotate/revoke it immediately, 2) remove from history (`git filter-repo` or BFG), 3) force-push and notify collaborators. Deleting the file in a new commit is not enough.
- Scan: `gitleaks detect`, `trufflehog`, GitHub secret scanning + push protection. Add as a pre-commit hook.

## Dependencies
```bash
pip install pip-audit && pip-audit -r requirements.txt
npm audit --omit=dev
```
Pin versions, update regularly, remove unused packages.

## Static analysis
`bandit -r .` (Python), `semgrep --config auto`, ESLint with `eslint-plugin-security`.

## Deployment
- HTTPS with valid TLS (Let's Encrypt), HSTS, redirect HTTP→HTTPS.
- Run app as non-root; minimal Docker image; no secrets baked into images.
- DB not publicly exposed; least-privilege DB user; backups encrypted and tested.
- Firewall: open only 80/443 (+ SSH restricted by key/IP).
- Reverse proxy (nginx): hide version, set security headers, limit body size, rate limit.
- Separate dev/staging/prod credentials.
- Logging + monitoring (Sentry, fail2ban, alerts on 401/403/5xx spikes).

## Security headers checklist
`Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`.

## Authorized testing tools (own apps only)
OWASP ZAP, Burp Suite Community, `nikto`, `sqlmap` (staging only, with permission), securityheaders.com.
