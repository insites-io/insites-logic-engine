# Liquid Types -- Gotchas and Common Errors

## Common Errors

### "Empty string passes my if check"

**Cause:** Empty strings `""` are truthy in Liquid. Only `nil` and `false` are falsy.

**Solution:** Use `!= blank` instead of a bare truthiness check:

```liquid
{% comment %} WRONG {% endcomment %}
{% if user.name %}show name{% endif %}

{% comment %} CORRECT {% endcomment %}
{% if user.name != blank %}show name{% endif %}
```

### "parse_json gives invalid JSON error"

**Cause:** Interpolated string values contain unescaped quotes that break the JSON structure.

**Solution:** Always use `| json` filter when interpolating string variables:

```liquid
{% comment %} WRONG: breaks if name contains quotes {% endcomment %}
{% parse_json obj %}{ "name": "{{ name }}" }{% endparse_json %}

{% comment %} CORRECT: json filter escapes quotes {% endcomment %}
{% parse_json obj %}{ "name": {{ name | json }} }{% endparse_json %}
```

### "Comparing number from URL param fails"

**Cause:** All `context.params` values are strings. `"5" > 3` does not behave as expected.

**Solution:** Convert to number first with `| plus: 0`:

```liquid
{% assign page = context.params.page | plus: 0 %}
{% if page > 1 %}show prev link{% endif %}
```

### "contains does not find my number in the array"

**Cause:** The `contains` operator performs string comparison. It will not match numeric array elements.

**Solution:** Use `array_any` for non-string matching:

```liquid
{% comment %} WRONG: contains uses string comparison {% endcomment %}
{% if ids contains 5 %}found{% endif %}

{% comment %} CORRECT: array_any handles type matching {% endcomment %}
{% assign found = ids | array_any: 5 %}
{% if found %}found{% endif %}
```

### "Zero evaluates as truthy in my conditional"

**Cause:** `0` is truthy in Liquid. This differs from most programming languages.

**Solution:** Explicitly compare against zero:

```liquid
{% comment %} WRONG: 0 is truthy, this always passes for numbers {% endcomment %}
{% if count %}has items{% endif %}

{% comment %} CORRECT: explicit comparison {% endcomment %}
{% if count != 0 %}has items{% endif %}
{% if count > 0 %}has items{% endif %}
```

### "Boolean from parse_json acts like a string"

**Cause:** Using quotes around `true`/`false` in JSON creates strings, not booleans.

**Solution:** Do not quote boolean or number values in JSON:

```liquid
{% comment %} WRONG: "true" is a string {% endcomment %}
{% parse_json config %}{ "enabled": "true" }{% endparse_json %}

{% comment %} CORRECT: true without quotes is boolean {% endcomment %}
{% parse_json config %}{ "enabled": true }{% endparse_json %}
```

### "hash_assign does not create a new hash"

**Cause:** `hash_assign` modifies an existing hash. If the variable is nil, it fails silently.

**Solution:** Initialize the hash first, and write into it with `assign`, which now does
everything `hash_assign` did (`hash_assign` is deprecated and still works):

```liquid
{% assign my_hash = {} %}
{% assign my_hash["key"] = "value" %}
```

### "h[k] is null, expected Hash or Array"

**Cause:** a nested bracket or dot assignment whose intermediate container does not exist.
Measured on a v6 staging instance on 9 October 2026, `{% assign h = {} %}{% assign h["k"]["z"] = 1 %}`
stops the render with this error. Nothing is auto-created.

**Solution:** create each level before writing below it, or build the whole value as one
literal:

```liquid
{% assign h = {} %}
{% assign h["k"] = {} %}
{% assign h["k"]["z"] = 1 %}

{% assign h = { "k": { "z": 1 } } %}
```

### "Liquid syntax error: Unexpected character" on a string that holds a backslash

**Cause:** since the 26 August 2026 platform release a backslash inside a string literal
escapes the character after it. `\"` and `\'` put a delimiter inside a literal of the
same kind, and `\\` is one literal backslash. Any other `\X` is left exactly as written,
so `'\d+'`, `'\.'` and `'C:\temp'` still mean what they always did. The one spelling
that breaks is a lone trailing backslash, `'\'` or `"\"`: the backslash now escapes the
closing quote and the literal never ends. Most such files are rejected at deploy with
the error above, which names the line.

**Solution:** double it.

```liquid
{% assign a = value | remove: '\' %}        {%- comment -%} before {%- endcomment -%}
{% assign a = value | remove: '\\' %}       {%- comment -%} after  {%- endcomment -%}
{{ 'a\\b' }}                                {%- comment -%} a\b    {%- endcomment -%}
```

A literal that already contained `\\`, `\"` or `\'` parses either way but now yields a
different value, and no deploy error points at it: search for those three sequences.

### "My array from split contains empty strings"

**Cause:** Splitting a string with leading/trailing delimiters or consecutive delimiters produces empty string elements.

**Solution:** Use `compact` or manually filter:

```liquid
{% assign items = ",a,,b,c," | split: "," | compact %}
{% comment %} Note: compact removes nil, not empty strings. Use where or manual filtering {% endcomment %}
```

### "Accessing a nested hash key returns nil unexpectedly"

**Cause:** An intermediate key in the chain is nil, so the entire chain returns nil.

**Solution:** Check each level or use `default`:

```liquid
{% assign value = data.level1.level2.level3 | default: "fallback" %}
```

## Limits

| Constraint | Limit | Notes |
|------------|-------|-------|
| String size | No hard limit | Very large strings may slow rendering |
| Number range | Standard float range | Platform dependent, no BigInt |
| Hash nesting | No hard limit | Deep nesting impacts readability |
| Array size | No hard limit | Large arrays slow iteration |
| parse_json input | Must be valid JSON | Trailing commas not allowed |
| Integer division | Truncates to int | Use `times: 1.0` for float division |
| contains operator | String comparison only | Use `array_any` for other types |

## See Also

- [Types Overview](README.md) -- truthiness rules and type basics
- [Types Patterns](patterns.md) -- correct patterns for common tasks
- [Types Advanced](advanced.md) -- edge cases and deep dives
- [Variables Gotchas](../variables/gotchas.md) -- variable scoping pitfalls
