# Liquid Types

Liquid in Insites supports six core data types: String, Number, Boolean, Nil, Hash (Object), and Array. Understanding these types -- and especially their truthiness rules -- is essential for writing correct conditionals and data handling logic.

## Key Purpose

Every value in Liquid has a type that determines how it behaves in output, comparisons, and iteration. Insites extends standard Liquid with Hash and Array initialization via `parse_json`, and adds key assignment (`assign h["key"] = value`) and filters like `array_any` for richer data manipulation.

## When to Use

- **String** -- text content, template fragments, user input, identifiers
- **Number** -- counters, pagination, arithmetic, record IDs
- **Boolean** -- feature flags, conditional rendering, form state
- **Nil** -- absence of value, unset variables, failed lookups
- **Hash** -- structured data from GraphQL results, configuration objects, JSON payloads
- **Array** -- collections for iteration, multi-value form fields, split strings

## How It Works

### String

Declared with single or double quotes. Both are identical in behavior.

```liquid
{% assign greeting = "Hello World!" %}
{% assign name = 'Insites' %}
```

Strings support concatenation via `append` / `prepend` filters and interpolation inside `{{ }}` output tags.

### Number

Integers and floats. No quotes.

```liquid
{% assign count = 25 %}
{% assign price = 39.99 %}
{% assign negative = -7 %}
```

Arithmetic is done via filters: `plus`, `minus`, `times`, `divided_by`, `modulo`, `floor`, `ceil`, `round`.

### Boolean

Literal `true` or `false` without quotes.

```liquid
{% assign is_active = true %}
{% assign show_price = false %}
```

### Nil

The absence of a value. Returned when a variable is not set, a key does not exist, or a query returns no results. Nil outputs nothing and evaluates as falsy.

```liquid
{% if user %}
  Hello {{ user.name }}
{% endif %}
```

### Hash (Object)

Key-value dictionaries. Initialize with the `parse_json` filter or tag.

```liquid
{% assign config = '{"theme": "dark", "lang": "en"}' | parse_json %}

{% parse_json user %}
  { "name": "Alice", "role": "admin", "score": 42 }
{% endparse_json %}
```

Access values with dot notation or bracket notation:

```liquid
{{ user.name }}
{% assign key = "role" %}
{{ user[key] }}
```

### Array

Ordered collections. Initialize via `split` or `parse_json`.

```liquid
{% assign tags = "ruby,python,go" | split: "," %}
{% parse_json ids %}[1, 2, 3, 4, 5]{% endparse_json %}
{{ ids[0] }}
```

### Truthiness Rules

This is the single most important concept. Only **nil** and **false** are falsy. Everything else is truthy.

| Value | Truthy? |
|-------|---------|
| `"hello"` | Yes |
| `""` (empty string) | **Yes** |
| `0` | **Yes** |
| `true` | Yes |
| `false` | No |
| `nil` / `null` | No |
| Empty array `[]` | Yes |
| Empty hash `{}` | Yes |

Use `!= blank` to check for meaningful content:

```liquid
{% if value != blank %}
  has content
{% endif %}
```

## Getting Started

1. Use `assign` for simple values: `{% assign name = "Alice" %}`
2. Use `parse_json` for structured data (hashes and arrays)
3. Always remember: empty strings are truthy -- use `!= blank` to test for empty
4. Use `| json` filter when embedding string variables inside `parse_json` blocks
5. Access hash values with dot or bracket notation

## See Also

- [Variables](../variables/README.md) -- how to create and manage variables
- [Flow Control](../flow-control/README.md) -- conditionals that depend on truthiness
- [Liquid Filters](../filters/README.md) -- type conversion and manipulation filters
- [Liquid Objects](../objects/README.md) -- built-in objects like `context`
