# React / Frontend Security

- **XSS**: JSX escapes by default. Avoid `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`. If rendering HTML, sanitize: `DOMPurify.sanitize(html)`.
- **Token storage**: prefer httpOnly + Secure + SameSite cookies set by the server. `localStorage` tokens are readable by any XSS. If you must use memory/localStorage, keep access tokens short-lived.
- **Links**: validate user-supplied URLs (`https:` / `http:` only; block `javascript:`); add `rel="noopener noreferrer"` to `target="_blank"`.
- **Secrets**: anything in `REACT_APP_*` / `VITE_*` is public. Never put API secrets, private keys, or DB creds in frontend code.
- **CSP** header (set on server/CDN): `default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'`. Avoid `unsafe-inline`.
- **Route guards are UX only**: always enforce authorization on the API.
- **Dependencies**: `npm audit`, lockfile committed, review postinstall scripts, avoid abandoned packages.
- **CORS/CSRF**: with cookie auth send CSRF token header (`X-CSRFToken`) and `credentials: "include"` only to trusted origins.
- **Forms**: validate client-side for UX, re-validate server-side.
- **Build**: disable source maps in production (or restrict), strip `console.log` of sensitive data.
- **Third-party scripts**: minimize; use Subresource Integrity.
