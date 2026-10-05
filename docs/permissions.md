# CRM Lite — Role-Based Access Control (RBAC) & Security

## 1. Role Matrix Overview

CRM Lite implements strict, server-enforced role permissions. Frontend route guards and button hiding are purely convenience layers; every API operation validates the requesting JWT user's role and object ownership.

| Capability / Action | Admin / Mentor | Sales Manager | Sales Executive / Intern |
|---|:---:|:---:|:---:|
| **Authentication & Profile** | Full | Full | Full |
| **Manage Users (Create/Delete)** | Yes | View Only | No |
| **View Leads** | All Team Leads | All Team Leads | Assigned / Created Only |
| **Create New Leads** | Yes | Yes | Yes |
| **Edit Assigned Leads** | Yes | Yes | Yes |
| **Edit Other Executive's Leads**| Yes | Yes | **Forbidden (403/404)** |
| **Delete Leads** | Yes | No | No |
| **Assign / Reassign Leads** | Yes | Yes | **Forbidden (403)** |
| **Convert Qualified Lead to Customer** | Yes | Yes | **Forbidden (403)** |
| **Convert Unqualified Lead** | **Forbidden (400)** | **Forbidden (400)** | **Forbidden (403)** |
| **Add Communication Notes** | Yes | Yes | On Assigned Leads |
| **Schedule Follow-ups** | Yes | Yes | On Assigned Leads |
| **Complete Follow-up** | Yes | Yes | Own Assigned Only |
| **View Reports & Dashboard** | Full Org-Wide | Team-Wide | Own Metric Scope |
| **Export Reports to CSV** | Yes | Yes | **Forbidden (403)** |
| **Manage Lead Sources** | Yes | Yes | Read-Only |
| **Create / Edit ICP Questions** | Yes | Yes | **Forbidden (403)** |
| **Delete / Deactivate ICP Questions** | Yes | Yes | **Forbidden (403)** |
| **Change ICP Scoring & Thresholds** | Yes | Yes | **Forbidden (403)** |
| **Run ICP Qualification Test** | Yes | Yes | On Assigned Leads |
| **View ICP Results & History** | All Leads | All Leads | On Assigned Leads |
| **Create / Edit / Delete PLD Problems** | Yes | Yes | **Forbidden (403)** |
| **Change PLD Qualification Threshold** | Yes | Yes | **Forbidden (403)** |
| **Configure Stage Requirements (Gates)** | Yes | Yes | **Forbidden (403)** |
| **Run PLD Assessment** | Yes | Yes | On Assigned Leads |
| **View PLD Results & History** | All Leads | All Leads | On Assigned Leads |
| **Move a Lead into a Gated Stage** | When requirements met | When requirements met | When requirements met |

---

## 2. Backend Permission Implementation

### Custom Permission Classes
1. `IsAdmin`:
   ```python
   class IsAdmin(BasePermission):
       def has_permission(self, request, view):
           return request.user.is_authenticated and (request.user.role == 'ADMIN' or request.user.is_superuser)
   ```
2. `IsManagerOrAdmin`:
   ```python
   class IsManagerOrAdmin(BasePermission):
       def has_permission(self, request, view):
           return request.user.is_authenticated and (request.user.role in ['ADMIN', 'MANAGER'] or request.user.is_superuser)
   ```
3. `LeadPermission`:
   - Validates object ownership for `EXECUTIVE` users (`obj.assigned_to_id == request.user.id or obj.created_by_id == request.user.id`).
   - Rejects `DELETE` requests unless the user has `ADMIN` role.
   - Scopes `get_queryset()` so executives never leak other reps' records in bulk listing or search queries.
4. `FollowUpPermission`:
   - Ensures an executive can only view, edit, or complete follow-ups assigned directly to them.
5. `ICPQuestionPermission` / `ICPScoringConfigPermission` (`icp/permissions.py`):
   - `GET` is allowed for any authenticated user so the test can be rendered; `POST` / `PUT` / `PATCH` / `DELETE` require `ADMIN` or `MANAGER`.
6. `ICPQualificationPermission` (`icp/permissions.py`):
   - Executives may only run the test and read results for leads assigned to or created by them; `visible_leads()` applies the same scoping as `LeadViewSet.get_queryset()`.
7. `PLDConfigPermission` (`pld/permissions.py`):
   - `GET` is allowed for any authenticated user so the assessment and stage-requirement views can render; `POST` / `PUT` / `PATCH` / `DELETE` on problems, gates and the scoring config require `ADMIN` or `MANAGER`.
8. `PLDAssessmentPermission` (`pld/permissions.py`):
   - The same lead scoping as ICP: executives may read a lead's PLD state, submit an assessment and view history only for leads assigned to or created by them.

---

## 3. Data Integrity & Validation Rules

- **Phone Deduplication**: Duplicate phone numbers are rejected for all active leads (`status not in ['WON', 'LOST']`).
- **Follow-up Past Date Prevention**: New follow-up tasks cannot be scheduled in the past (`follow_up_at >= now() - 5min`).
- **Lost Reason Enforcement**: Transitioning any lead to `status = 'LOST'` mandates a non-empty `lost_reason` field.
- **Conversion Safety**: Conversion requires `status == 'QUALIFIED'`. Once converted, duplicate conversion attempts are rejected, and the operation runs within an atomic database transaction (`transaction.atomic()`).
- **ICP Scoring Integrity**: Scores are always recalculated server-side from the stored question configuration — any client-supplied points are discarded. Only active questions may be answered, option IDs must belong to the question being answered, and every required active question must be answered before submission.
- **ICP Historical Immutability**: Each qualification stores a snapshot of the question text, options and point values in force at the time. Editing a question's scoring later never changes past results, and deleting a question leaves its history intact.
- **PLD Scoring Integrity**: Scores are always recalculated server-side from the stored problem list — only problem IDs are accepted, never points. At least one problem must be selected, and unknown or inactive problem IDs are rejected with `400`.
- **PLD Historical Immutability**: Each assessment stores a snapshot of the problem names, points and severity in force at the time plus the threshold used, so later edits or deletions never change past results.
- **PLD Stage Gates**: `LeadCreateUpdateSerializer.validate` re-checks the target stage's gate on every actual stage change. Lead creation is deliberately exempt — a new lead has no ICP/PLD history yet, so a requirement on the entry stage can never block `POST /api/leads/`. A gate is opt-in per stage; stages without a gate row are unaffected.
