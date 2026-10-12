import { describe, expect, it } from "vitest";
import { fileKindForPath, validate } from "../src/validators.js";

describe("fileKindForPath", () => {
  it("identifies pages", () => {
    expect(fileKindForPath("app/views/pages/index.liquid")).toBe("page");
    expect(fileKindForPath("modules/website/public/views/pages/about.liquid")).toBe("page");
  });
  it("identifies partials", () => {
    expect(fileKindForPath("app/views/partials/shared/header.liquid")).toBe("partial");
  });
  it("identifies commands", () => {
    expect(fileKindForPath("app/lib/commands/products/create.liquid")).toBe("command");
  });
  it("identifies graphql", () => {
    expect(fileKindForPath("app/graphql/products/search.graphql")).toBe("graphql");
  });
});

describe("validators", () => {
  it("flags partials with underscore prefix", async () => {
    const result = await validate("app/views/partials/_card.liquid", "");
    const matched = result.violations.filter((v) => v.ruleId === "partials-no-underscore-prefix");
    expect(matched).toHaveLength(1);
  });

  it("does not flag tags whose name only starts with 'form'", async () => {
    // Regression for the form-tag regex tightening: {% formula %} or {% format %} would have
    // been swept up by the old loose regex. The anchored \b version excludes them.
    const content = "<div>\n{% formula x: 1 %}\n{% format y %}\n</div>";
    const result = await validate("app/forms/account/sign_out.liquid", content);
    const r5 = result.violations.filter((v) => v.ruleId === "forms-no-form-tag");
    expect(r5).toHaveLength(0);
  });

  it("does not flag normal partials", async () => {
    const result = await validate("app/views/partials/card.liquid", "");
    expect(result.violations.find((v) => v.ruleId === "partials-no-underscore-prefix")).toBeUndefined();
  });

  it("flags unfiltered parse_json interpolation", async () => {
    const content = `
{% parse_json object %}
  {
    "title": "{{ form.title }}",
    "price": {{ form.price | json }}
  }
{% endparse_json %}
    `;
    const result = await validate("app/lib/commands/products/create.liquid", content);
    const r11 = result.violations.filter((v) => v.ruleId === "pipe-vars-through-json-filter");
    expect(r11.length).toBeGreaterThanOrEqual(1);
    expect(r11[0].message).toContain("form.title");
  });

  it("does not flag parse_json with json filter", async () => {
    const content = `
{% parse_json object %}
  {
    "title": {{ form.title | json }},
    "price": {{ form.price | json }}
  }
{% endparse_json %}
    `;
    const result = await validate("app/lib/commands/products/create.liquid", content);
    const r11 = result.violations.filter((v) => v.ruleId === "pipe-vars-through-json-filter");
    expect(r11).toHaveLength(0);
  });

  it("flags the {% form %} tag", async () => {
    const content = "<div>\n{% form method: 'post' %}\n  ...\n{% endform %}\n</div>";
    const result = await validate("app/forms/account/sign_out.liquid", content);
    const r5 = result.violations.filter((v) => v.ruleId === "forms-no-form-tag");
    expect(r5.length).toBeGreaterThanOrEqual(1);
  });
});

describe("API endpoint validators", () => {
  const API = "modules/shop/public/views/pages/api/_external/v2/products/get.liquid";
  const hits = async (ruleId: string, path: string, content: string) =>
    (await validate(path, content)).violations.filter((v) => v.ruleId === ruleId);

  describe("api-pages-declare-a-guard", () => {
    it("flags an API page with no policy and no guard", async () => {
      const content = "---\nslug: api/products\nmethod: get\n---\n{% graphql r = 'products/list' %}{{ r | json }}";
      expect(await hits("api-pages-declare-a-guard", API, content)).toHaveLength(1);
    });
    it("passes a page with a front-matter policy", async () => {
      const content =
        "---\nslug: api/products\nmethod: get\nauthorization_policies:\n  - modules/insites_core/has_valid_instance_api_authorization\n---\n{{ 1 }}";
      expect(await hits("api-pages-declare-a-guard", API, content)).toHaveLength(0);
    });
    it("passes a page with an inline guard function", async () => {
      const content =
        "---\nslug: crm/api/v2/contacts/:uuid\nmethod: get\n---\n{%- function api_auth_passed = 'modules/insites_core/functions/auth/api_key_guard' -%}";
      expect(await hits("api-pages-declare-a-guard", API, content)).toHaveLength(0);
    });
    it("passes a page that states why it is public", async () => {
      const content =
        "---\nslug: api/webhooks/stripe\nmethod: post\n---\n{% comment %}public endpoint: Stripe calls this; the signature is verified below{% endcomment %}";
      expect(await hits("api-pages-declare-a-guard", API, content)).toHaveLength(0);
    });
    it("flags a page whose policy key is empty", async () => {
      const content = "---\nslug: api/products\nauthorization_policies:\n---\n{{ 1 }}";
      expect(await hits("api-pages-declare-a-guard", API, content)).toHaveLength(1);
    });
    it("flags a page whose policy is commented out", async () => {
      const content = "---\nslug: api/products\n#authorization_policies:\n#  - some_policy\n---\n{{ 1 }}";
      expect(await hits("api-pages-declare-a-guard", API, content)).toHaveLength(1);
    });
    it("ignores pages outside views/pages/api", async () => {
      const content = "---\nslug: about\n---\n<h1>About</h1>";
      expect(await hits("api-pages-declare-a-guard", "app/views/pages/about.liquid", content)).toHaveLength(0);
    });
  });

  describe("api-slug-no-format-extension", () => {
    it("flags .json in the slug", async () => {
      const content = "---\nslug: api/products.json\nmethod: get\n---\n";
      const r = await hits("api-slug-no-format-extension", API, content);
      expect(r).toHaveLength(1);
      expect(r[0].line).toBe(2);
    });
    it("passes a slug without an extension", async () => {
      const content = "---\nslug: api/products\nformat: json\n---\n";
      expect(await hits("api-slug-no-format-extension", API, content)).toHaveLength(0);
    });
    it("does not match a segment that merely starts with json", async () => {
      const content = "---\nslug: api/products.jsonld-export\n---\n";
      expect(await hits("api-slug-no-format-extension", API, content)).toHaveLength(0);
    });
  });

  describe("api-no-credentials-in-url", () => {
    it("flags a credential slug segment", async () => {
      const content = "---\nslug: api/export/:api_key\nmethod: get\n---\n";
      expect(await hits("api-no-credentials-in-url", API, content)).toHaveLength(1);
    });
    it("flags a GET page reading a credential from the query string", async () => {
      const content = "---\nslug: api/export\nmethod: get\n---\n{% if context.params.api_key == context.constants.KEY %}";
      expect(await hits("api-no-credentials-in-url", API, content)).toHaveLength(1);
    });
    it("passes a POST page reading a password from the body", async () => {
      const content = "---\nslug: api/sessions\nmethod: post\n---\n{% assign p = context.params.password %}";
      expect(await hits("api-no-credentials-in-url", API, content)).toHaveLength(0);
    });
    it("passes a one-time token in a GET link", async () => {
      const content = "---\nslug: account/verify\nmethod: get\n---\n{% assign t = context.params.token %}";
      expect(await hits("api-no-credentials-in-url", API, content)).toHaveLength(0);
    });
    it("passes a header-borne key", async () => {
      const content = "---\nslug: api/export\nmethod: get\n---\n{% assign k = context.headers.HTTP_X_API_KEY %}";
      expect(await hits("api-no-credentials-in-url", API, content)).toHaveLength(0);
    });
  });
});
