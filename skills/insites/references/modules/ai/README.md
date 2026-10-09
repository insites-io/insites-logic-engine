# AI (MCP server)

`module-ai` is **not an instance module**. It is a Python service (FastAPI, Model Context
Protocol tools, a LangChain agent on Google Vertex AI Gemini) that runs on Google Cloud Run
and calls an Insites instance's REST API from outside. It declares no `hook_module_info`,
no tables, no controller aliases and no Liquid, so there is nothing to install on an
instance and nothing to call from a page. Read from the repository on 9 October 2026 at
its only tag, v5.0.0; its last commit is from 16 January 2026.

## What it does

The service exposes a small REST surface of its own (`/tools` lists the registered tools)
and streams agent responses over Server-Sent Events. Its tools are thin wrappers over the
instance's V2 API, authenticated with an instance API key sent raw in the `Authorization`
header, exactly as [authentication](../../api/authentication.md) describes:

| Tool group | Tools | Instance endpoints called |
|---|---|---|
| Contacts | `get_contacts`, `get_contact_by_uuid`, `save_contact` | `/crm/api/v2/contacts`, `/crm/api/v2/contacts/{uuid}` |
| Contact addresses and relationships | `get_contact_addresses`, `get_contact_addresses_by_uuid` | `/crm/api/v2/contacts/addresses`, `/crm/api/v2/contacts/relationships` |
| Companies | `get_companies`, `get_company_relationships`, `get_company_addresses` | `/crm/api/v2/companies`, `/crm/api/v2/companies/{uuid}`, `/crm/api/v2/companies/addresses`, `/crm/api/v2/companies/relationships` |
| System and custom fields | `get_system_fields`, `get_contact_sytem_fields`, `get_company_sytem_fields` (the misspelling is in the source) | `/crm/api/v2/system-fields`, `/crm/api/v2/custom-fields/contacts`, `/crm/api/v2/custom-fields/companies` |
| Data module | (instance tools) | `/databases/api/v2/database/...` |
| Utility | `list_available_tools` | none |

A second server, `servers/instance_server.py`, holds instance-provisioning tools that call
an AWS workflow with a JWT, configured through `AWS_CREATE_INSTANCE_URL`,
`AWS_INSTANCE_JWT_SECRET` and a Console API key. Secrets come from Google Secret Manager
(`utils/secret_manager.py`); the instance it talks to is set by `INSTANCE_URL` and
`INSTANCE_API_KEY` (older names `CRM_INSTANCE_URL`, `CRM_INSTANCE_API_KEY`).

## What this means for a builder

- **To call the CRM from your own code, call the V2 API directly.** The endpoints this
  service wraps are documented in [the CRM module](../crm/api.md); the service adds an
  agent in front of them, not capability.
- **The surface it knows is the v5 CRM of January 2026.** It predates the v6 modules, the
  pipelines and events APIs, and the `insites_core` to `insites_crm` rename; its contact
  and company calls still work because those paths did not change.
- **Not a Liquid concern.** If you are writing pages on an instance, nothing here applies.

No `api.md`, `configuration.md`, `patterns.md`, `gotchas.md` or `advanced.md` exists for
this entry on purpose: the service's own README, `CREDENTIALS_SETUP.md` and
`DEPLOYMENT_DOCUMENTATION.md` in its repository cover running it, and that is operations,
not instance building.
