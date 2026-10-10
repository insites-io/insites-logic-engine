# Rules — GraphQL

Rules that apply to `.graphql` files (typically under `app/graphql/` or `modules/{name}/public/graphql/`).

---

```yaml
---
id: graphql-tables-fully-qualified
applies_to: [graphql]
severity: info
evidence: real-project
evidence_source: "100% compliance across 20+ GraphQL files for module tables (modules/{name}/{table}). A table defined in app/schema/ answered every query and mutation by its plain file name on a production instance on 9 October 2026."
audit_ref: audit/v0-conflicts-batch2.md#rule-r-15
---
```

**Rule:** Name a table by where it is defined. A module's table carries its module path, `modules/{module}/{table}` (e.g. `modules/insites_crm/contact`, `modules/insites_ecommerce/product`). A table defined in the project's own `app/schema/` is named by its file name (`signin_code` for `app/schema/signin_code.yml`).

**Why:** The same table name can exist in several modules, so a module table needs its prefix to resolve. An `app/schema/` table belongs to no module, and its plain name works: `records`, `record_create`, `records_update_all` and `external_id` claims all ran against `table: "pwless_demo_code"` on a production instance on 9 October 2026. An earlier version of this rule required the prefix for every table, which is wrong for `app/` tables.

**How to apply:**
- ✅ `table: { value: "modules/insites_ecommerce/discount" }` (module table)
- ✅ `table: { value: "modules/insites_crm/contact" }` (module table)
- ✅ `table: { value: "signin_code" }` (defined in `app/schema/signin_code.yml`)
- ❌ `table: { value: "discount" }` when `discount` is a module's table: give it the module path

**Verified by:**
- `app-portal/modules/client/public/graphql/discount/get_discount_by_code.graphql:11`
- `addon-ecommerce/modules/ecommerce/public/graphql/products/search_products.graphql:18`
- `addon-ecommerce/modules/ecommerce/public/graphql/products/is_product_existing.graphql:11,23,30,37`

---

```yaml
---
id: use-related-record-for-joins
applies_to: [graphql]
severity: warning
evidence: real-project
evidence_source: "20+ files use related_record() / related_records() correctly. Property arrays used for filtering only, not joins."
audit_ref: audit/v0-conflicts-batch3.md#rule-r-21
---
```

**Rule:** Use `related_record(...)` and `related_records(...)` GraphQL operators for joins to related records. Use `properties: [...]` arrays only for filtering by schema property values.

**Why:** Property-array-based "joins" don't actually join — they filter by ID matches and miss the platform's relationship semantics (cascading, eager loading, pagination on the joined side). `related_record` / `related_records` are the platform's native join operators and should be used whenever the relationship is real.

**How to apply:**
- Belongs-to: `company: related_record(table: "modules/insites_crm/company", join_on_property: "company_id") { name }`
- Has-many: `variants: related_records(table: "modules/insites_ecommerce/variant", join_on_property: "product_id") { ... }`
- Filter only: `filter: { properties: [{ name: "status", value: $status }] }` — this is correct usage of property arrays (not a join).

**Verified by:**
- `app-portal/modules/portal/public/graphql/account/get_current_user.graphql` — uses `related_record()` for crm_company
- `addon-ecommerce/modules/ecommerce/public/graphql/products/get_product.graphql` — uses `related_records()` for variants and gallery
