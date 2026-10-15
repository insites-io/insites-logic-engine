# Liquid Types -- Advanced Topics

Deep dives into type behavior edge cases, coercion rules, and advanced data manipulation in Insites Liquid.

## Type Coercion Rules

Liquid performs implicit coercion in several contexts. Understanding when and how this happens prevents subtle bugs.

### Comparison coercion

When comparing values of different types, Liquid follows these rules:

```liquid
{% comment %} String vs Number: string is converted to number if possible {% endcomment %}
{% if "42" == 42 %}true{% endif %}       {% comment %} -> true {% endcomment %}
{% if "abc" == 0 %}true{% endif %}       {% comment %} -> false {% endcomment %}

{% comment %} Nil comparisons {% endcomment %}
{% if nil == nil %}true{% endif %}        {% comment %} -> true {% endcomment %}
{% if nil == false %}true{% endif %}      {% comment %} -> false (different types) {% endcomment %}
{% if nil == "" %}true{% endif %}         {% comment %} -> false {% endcomment %}
```

### Output coercion

All values are converted to strings when output via `{{ }}`:

```liquid
{{ 42 }}          {% comment %} -> "42" {% endcomment %}
{{ true }}        {% comment %} -> "true" {% endcomment %}
{{ nil }}         {% comment %} -> "" (empty, nothing rendered) {% endcomment %}
{{ false }}       {% comment %} -> "false" {% endcomment %}
```

### Filter chain coercion

Filters that expect specific types will coerce input:

```liquid
{{ "hello" | plus: 0 }}      {% comment %} -> 0 (string coerced to 0) {% endcomment %}
{{ "5abc" | plus: 0 }}       {% comment %} -> 5 (partial numeric parse) {% endcomment %}
{{ true | append: "" }}      {% comment %} -> "true" {% endcomment %}
```

## Deep Hash Manipulation

### Nested hash creation from scratch

```liquid
{% parse_json settings %}{}{% endparse_json %}
{% hash_assign settings["ui"] = nil %}
{% parse_json ui_defaults %}{"theme": "light", "sidebar": true}{% endparse_json %}
{% hash_assign settings["ui"] = ui_defaults %}
{% hash_assign settings["ui"]["theme"] = "dark" %}

{{ settings | json }}
{% comment %} -> {"ui":{"theme":"dark","sidebar":true}} {% endcomment %}
```

### Recursive hash merge behavior

`hash_merge` performs a shallow merge. Nested hashes are replaced, not merged:

```liquid
{% parse_json base %}{ "a": 1, "nested": { "x": 1, "y": 2 } }{% endparse_json %}
{% parse_json override %}{ "nested": { "x": 99 } }{% endparse_json %}

{% assign result = base | hash_merge: override %}
{{ result | json }}
{% comment %} -> {"a":1,"nested":{"x":99}} -- note "y" is LOST {% endcomment %}
```

To do a deep merge, merge nested hashes separately:

```liquid
{% assign nested_merged = base.nested | hash_merge: override.nested %}
{% hash_assign base["nested"] = nested_merged %}
{% assign result = base | hash_merge: override_without_nested %}
```

### Converting hash to array of pairs

```liquid
{% parse_json meta %}{"author": "Jane", "year": 2024}{% endparse_json %}
{% parse_json pairs %}[]{% endparse_json %}

{% for item in meta %}
  {% parse_json pair %}
    { "key": {{ item[0] | json }}, "value": {{ item[1] | json }} }
  {% endparse_json %}
  {% assign pairs = pairs | array_add: pair %}
{% endfor %}
```

## Advanced Array Operations

### Array deduplication by property

```liquid
{% parse_json seen_ids %}[]{% endparse_json %}
{% parse_json unique_items %}[]{% endparse_json %}

{% for item in items %}
  {% assign id_str = item.id | append: "" %}
  {% unless seen_ids contains id_str %}
    {% assign unique_items = unique_items | array_add: item %}
    {% assign seen_ids = seen_ids | array_add: id_str %}
  {% endunless %}
{% endfor %}
```

### Array intersection (items in both arrays)

```liquid
{% parse_json intersection %}[]{% endparse_json %}

{% for item in array_a %}
  {% assign item_str = item | append: "" %}
  {% if array_b contains item_str %}
    {% assign intersection = intersection | array_add: item %}
  {% endif %}
{% endfor %}
```

### Array difference (items in A but not B)

```liquid
{% parse_json difference %}[]{% endparse_json %}

{% for item in array_a %}
  {% assign item_str = item | append: "" %}
  {% unless array_b contains item_str %}
    {% assign difference = difference | array_add: item %}
  {% endunless %}
{% endfor %}
```

### Grouping array items by property

```liquid
{% parse_json groups %}{}{% endparse_json %}

{% for item in items %}
  {% assign group_key = item.category %}
  {% if groups[group_key] == nil %}
    {% parse_json empty_arr %}[]{% endparse_json %}
    {% hash_assign groups[group_key] = empty_arr %}
  {% endif %}
  {% assign updated = groups[group_key] | array_add: item %}
  {% hash_assign groups[group_key] = updated %}
{% endfor %}
```

## Nil Propagation

Understanding how nil propagates through filter chains prevents unexpected output.

```liquid
{% comment %} Nil through filters {% endcomment %}
{{ nil | upcase }}              {% comment %} -> "" (empty) {% endcomment %}
{{ nil | plus: 5 }}             {% comment %} -> 5 {% endcomment %}
{{ nil | default: "fallback" }} {% comment %} -> "fallback" {% endcomment %}
{{ nil | json }}                {% comment %} -> "null" {% endcomment %}
{{ nil | size }}                {% comment %} -> 0 {% endcomment %}
```

### Default filter edge cases

The `default` filter triggers on nil, false, and empty string:

```liquid
{{ nil | default: "x" }}       {% comment %} -> "x" {% endcomment %}
{{ false | default: "x" }}     {% comment %} -> "x" {% endcomment %}
{{ "" | default: "x" }}        {% comment %} -> "x" {% endcomment %}
{{ 0 | default: "x" }}         {% comment %} -> 0 (0 is NOT nil/false/"") {% endcomment %}
{{ "hi" | default: "x" }}     {% comment %} -> "hi" {% endcomment %}
```

**Note:** `default` treats empty string as "default-worthy" but `if` treats it as truthy. These are inconsistent by design.

## Complex parse_json Patterns

### Multi-level nested JSON with interpolation

```liquid
{% parse_json payload %}
  {
    "user": {
      "name": {{ user_name | json }},
      "email": {{ user_email | json }}
    },
    "items": [
      {% for item in cart_items %}
        {
          "id": {{ item.id }},
          "qty": {{ item.quantity }},
          "title": {{ item.title | json }}
        }{% unless forloop.last %},{% endunless %}
      {% endfor %}
    ],
    "metadata": {
      "timestamp": {{ "now" | date: "%s" }},
      "source": "web"
    }
  }
{% endparse_json %}
```

### Conditional JSON structure

```liquid
{% capture json_str %}
  {
    "type": {{ type | json }}
    {% if description != blank %}
      , "description": {{ description | json }}
    {% endif %}
    {% if tags.size > 0 %}
      , "tags": {{ tags | json }}
    {% endif %}
  }
{% endcapture %}
{% assign data = json_str | parse_json %}
```

## Reference Equality

Liquid does not have reference equality. All comparisons are by value:

```liquid
{% parse_json a %}{"x": 1}{% endparse_json %}
{% parse_json b %}{"x": 1}{% endparse_json %}
{% if a == b %}equal{% endif %}
{% comment %} -> "equal" (compared by value) {% endcomment %}
```

Assigning a hash/array creates a reference, not a copy:

```liquid
{% parse_json original %}{"x": 1}{% endparse_json %}
{% assign copy = original %}
{% hash_assign copy["x"] = 99 %}
{{ original.x }}
{% comment %} -> 99 (both point to same object) {% endcomment %}
```

To create a true copy, round-trip through JSON:

```liquid
{% assign deep_copy = original | json | parse_json %}
```

## See Also

- [Types Overview](README.md) -- introduction and truthiness rules
- [Types Gotchas](gotchas.md) -- common errors to avoid
- [Variables Advanced](../variables/advanced.md) -- advanced variable patterns
- [Liquid Filters](../filters/README.md) -- complete filter reference
