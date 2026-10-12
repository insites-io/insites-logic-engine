# User Profile Types

A user profile type is a YAML schema that defines extra data attached to a user — first/last name, role, custom fields, etc. Profiles live in their own table (one record per `(user_id, profile_type)` pair), separate from the `users` table itself.

A single user can have **multiple profile records of different types** (e.g. a `crm_contact` profile when they're a CRM contact, and a separate `staff_member` profile when they're an employee). Each profile is read and written independently.

## Properties on the user itself: `app/user.yml`

A profile type is a separate table. A property stored on the user record itself, such as the `roles` array the [authentication references](../authentication/configuration.md#declare-the-roles-property-first) check, is declared in `app/user.yml` instead, as a list:

```yaml
# app/user.yml
properties:
  - name: roles
    type: array
```

A stock instance declares no user properties. Until a property is declared, `property_array` on it reads back `[]` and a filter on it returns a GraphQL error inside the result, with no Liquid error. Write it with `user_update(id: ..., user: { properties: [{ name: "roles", value_array: $roles }] })`. Insites' own Console declares its user properties the same way.

## File location

```
modules/<name>/public/user_profile_types/<type>.yml
```

Example: `modules/dashboard/public/user_profile_types/crm_contact.yml`

## Minimal schema

```yaml
name: crm_contact
properties:
  - name: first_name
    type: string
    validation: { presence: true }
  - name: last_name
    type: string
    validation: { presence: true }
  - name: phone
    type: string
  - name: role
    type: string
    default: 'contact'
  - name: avatar
    type: upload
    options: { acl: public }
```

## Querying profiles

Profiles are joined to users via `related_record` in GraphQL:

```graphql
profile: related_record(
  table: "modules/dashboard/public/user_profile_types/crm_contact",
  join_on_property: "id",
  foreign_property: "user_id"
) {
  first_name: property(name: "first_name")
  last_name: property(name: "last_name")
  role: property(name: "role")
}
```

Property accessors (`property`, `property_float`, `property_upload`, `property_array`, …) read typed values exactly as for any other record. See [`graphql/api.md`](../graphql/api.md) for the full accessor list.

## Writing profiles

Use `record_create` / `record_update` against the profile type's table:

```graphql
mutation update_profile($user_id: ID!, $first_name: String!, $last_name: String!) {
  record_update(
    id: $user_id,
    record: {
      table: "modules/dashboard/public/user_profile_types/crm_contact",
      properties: [
        { name: "first_name", value: $first_name }
        { name: "last_name", value: $last_name }
      ]
    }
  ) { id }
}
```

Form definitions ([`forms/`](../forms/README.md)) are the canonical caller — declare validation in YAML, run the mutation in `callback_actions`.

## Multi-profile users

When a user has more than one profile type, filter explicitly when joining:

```graphql
crm_profile: related_record(
  table: "modules/dashboard/public/user_profile_types/crm_contact",
  join_on_property: "id", foreign_property: "user_id"
) { ... }

staff_profile: related_record(
  table: "modules/dashboard/public/user_profile_types/staff_member",
  join_on_property: "id", foreign_property: "user_id"
) { ... }
```

Don't assume "the user's profile" — there may be zero, one, or several depending on what the user is in the system.

## See Also

- [`graphql/README.md`](../graphql/README.md) — `User profiles and user_profile_types/` section
- [`graphql/api.md`](../graphql/api.md) — property accessors
- [`forms/README.md`](../forms/README.md) — form definitions + callback_actions for writes
- [`schema/`](../schema/README.md) — for non-user-attached tables
