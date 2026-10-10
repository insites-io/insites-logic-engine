# Module Name - Gotchas

## Module Not Installed

**Symptom:** `Liquid error: Could not find partial 'modules/<module-name>/...'`

**Fix:** Insites modules are installed and updated through the Insites Console, not the CLI. There is no `insites-cli modules install`. Check what is installed with `insites-cli modules list <env>`.

## Changing This Module's Behavior From Your Project

This module ships with the instance and is not in your repo, so you can't edit its files. To change its behavior, shadow the file you want to replace with a same-path file in your own module (first match wins), or compose around its exports with `{% render %}`, `{% function %}` and its GraphQL. Your own modules under `modules/` are fully editable, `public/` and `private/` alike.

## Missing Constants

**Symptom:** Module features fail silently or return errors.

**Fix:** Ensure all required constants are set. See [configuration.md](./configuration.md).

## See Also

- [README](./README.md)
- [Configuration](./configuration.md)
- [Patterns](./patterns.md)
