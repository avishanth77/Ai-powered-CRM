# OWASP Top 10: Vulnerable → Fixed

## A01 Broken access control / IDOR
```python
# Vulnerable: any user can read any order
Order.objects.get(pk=pk)
# Fixed: scope to owner
get_object_or_404(Order, pk=pk, user=request.user)
```
Check: change the ID in URL/body as another user; expect 403/404. Enforce on every endpoint, including write and delete.

## A02 Cryptographic failures
Hash passwords with Argon2/bcrypt (Django default PBKDF2 or `argon2`). HTTPS everywhere. Never store card data or plain secrets. Use `secrets` not `random` for tokens.

## A03 Injection (SQL, command, template)
```python
# Vulnerable
cursor.execute(f"SELECT * FROM users WHERE name='{name}'")
# Fixed: parameterized / ORM
cursor.execute("SELECT * FROM users WHERE name=%s", [name])
User.objects.filter(name=name)
```
Avoid `os.system`, `shell=True`, `eval`, `pickle.loads` on untrusted data. Use `subprocess.run([...], shell=False)`.

## A04 Insecure design
Rate-limit login/reset/OTP, add account lockout, require re-auth for sensitive actions, threat-model flows before building.

## A05 Security misconfiguration
`DEBUG=False`, no default creds, no stack traces to users, remove unused endpoints/admin exposure, set security headers, least-privilege cloud/DB roles.

## A06 Vulnerable components
`pip-audit`, `npm audit`, Dependabot/Renovate; pin versions; remove unused packages.

## A07 Auth failures
Strong password validators, MFA option, short-lived access tokens, rotate refresh tokens, invalidate on logout/password change, generic login errors, constant-time comparison.

## A08 Integrity failures
Verify signed webhooks, pin CI actions, no untrusted deserialization, subresource integrity for CDN scripts.

## A09 Logging & monitoring
Log auth events, permission denials, input validation failures. Never log passwords, tokens, or PII. Alert on anomalies.

## A10 SSRF
Validate/allowlist outbound URLs; block internal IP ranges (127.0.0.1, 169.254.169.254, 10/8, 192.168/16); don't follow redirects blindly.

## XSS
Escape on output (templates auto-escape; don't use `|safe` or `mark_safe` on user data). In React avoid `dangerouslySetInnerHTML`; if needed sanitize with DOMPurify. Add CSP.

## CSRF
Cookie-based auth needs CSRF tokens + `SameSite`. Token-in-header (Bearer) APIs are not CSRF-prone but must protect against XSS token theft.

## File upload
Allowlist extension + MIME + magic bytes, cap size, rename files, store outside web root / in object storage, never execute uploads, serve with `Content-Disposition` and correct type.

## Open redirect
Validate `next` URLs with `url_has_allowed_host_and_scheme`.
