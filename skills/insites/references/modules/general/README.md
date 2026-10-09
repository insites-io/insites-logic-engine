# General (shared admin UI assets)

`module-general` is **not an instance module**. Nothing installs it, it declares no
`hook_module_info`, no tables, no controller aliases and no API, and there is nothing in
it to call from Liquid. It is the source repository for the shared admin UI assets that
every Insites admin module loads from `https://components.insites.io/dist/`, through each
module's `insites_components.liquid` partial and its `vue/index.html`. Read from the repo's
own README on 9 October 2026 (its last commit, 8 October 2026, was an S3 uploader fix).

Its name is historical. Open questions about renaming it or folding it into the CRM
module are tracked in TW#26045638 and TW#26253080.

## What is in the repository

| Directory | Contents |
|---|---|
| `vue/components/` | About 30 shared Vue components the admin screens compose: ListPage, Import, Export, Drawer, AdvancedFilter and the rest |
| `scripts/` | Sixteen `Insites*` browser libraries with their minified builds: InsitesCore, InsitesUtil, InsitesAJAX, InsitesImport and InsitesImportModal, InsitesExport, InsitesFileUploader, InsitesS3Uploader and S3UploaderService, InsitesBulkAction, InsitesNotify, InsitesToaster, InsitesProgressBar, InsitesFormProcessor, InsitesFormFieldProcessor, InsitesFormValidations |
| `styles/` | The SASS framework (`styles/sass/`) and its compiled CSS (`styles/css/`: `InsitesAdmin.min.css`, `app.min.css`) |
| `forms/` | The forms runtime served to public pages: InsitesFormProcessor, InsitesFormValidations, InsitesFormConditions, InsitesFormFieldValue, InsitesFormUploader, and their CSS |

Built files are committed beside their source, and the file host is populated from the
built files. There is no CI and no release pipeline: publishing is a manual upload, so
what is live on the file host and what is in the repository can drift. Check the repo
before assuming the two match.

## What this means for a builder

- **Nothing to install or configure.** An instance's admin already loads these assets.
- **Nothing to call.** If you are writing Liquid on an instance, the modules you call are
  in the [alias inventory](../../building-on-insites/reference/alias-inventory.md); this
  repository is not among them.
- **Do not copy it.** The repository has been duplicated twice and both copies are dead
  (TW#26045638). It is the single source of truth for these assets.
- **The forms runtime is the one piece a public page meets.** A page rendered by the Forms
  module loads `forms/*.js` from the file host; see [the forms module](../forms/README.md)
  for how a form is built and submitted, and [forms](../../forms/README.md) for plain HTML
  forms and CSRF.

## Related

- The newer component bundle the v6 admin shell loads is a separate repository and file
  host path; the per-module `?updated=` cache buster and the platform's asset filters are
  covered in [assets](../../assets/README.md).
- No `api.md`, `configuration.md`, `patterns.md`, `gotchas.md` or `advanced.md` exists for
  this entry on purpose: there is no API, no configuration and no behaviour to document.
