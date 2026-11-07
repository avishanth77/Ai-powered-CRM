# API Testing (REST)

For each endpoint verify:
- **Status codes**: 200/201/204 success; 400 bad input; 401 unauthenticated; 403 forbidden; 404 missing; 409 conflict; 422 validation; 429 rate limit; 5xx never for client mistakes.
- **Schema**: field names, types, required/optional, nullability, enums, date formats.
- **Validation**: missing/extra/wrong-type fields, boundaries, empty body, malformed JSON.
- **Auth**: no token, expired, tampered, wrong role, other user's resource (IDOR).
- **Idempotency**: repeat PUT/DELETE; duplicate POST.
- **Pagination/filter/sort**: first/last/out-of-range page, bad params.
- **Data integrity**: response matches DB; side effects happen once.
- **Errors**: consistent error body, no stack traces or internals leaked.
- **Performance**: response time baseline, large payloads.
- **Headers**: Content-Type, CORS, caching, security headers.

## Postman test snippet
```js
pm.test("status 200", () => pm.response.to.have.status(200));
pm.test("json body", () => pm.response.to.be.json);
pm.test("schema basics", () => {
  const j = pm.response.json();
  pm.expect(j).to.have.property("id");
  pm.expect(j.email).to.be.a("string");
});
pm.test("fast", () => pm.expect(pm.response.responseTime).to.be.below(800));
```
