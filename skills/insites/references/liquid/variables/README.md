# Liquid Variables

Variables in Insites are **LOCAL** to the partial/page where they are defined. A variable defined in a partial is NOT available in the calling page.

## assign

Creates a named variable.

```liquid
{% assign favorite_food = 'apples' %}
{% assign is_active = true %}
{% assign count = 42 %}
```

## capture

Captures a block of output into a string variable.

```liquid
{% capture full_name %}{{ first_name }} {{ last_name }}{% endcapture %}
{{ full_name }}
```

## parse_json

Creates a hash/array from JSON. Insites-specific.

```liquid
{% parse_json about_me %}
  {
    "name": {{ name | json }},
    "age": {{ age }},
    "tags": ["developer", "admin"]
  }
{% endparse_json %}
```

**Common error**: Missing or trailing commas in JSON.

**Always use `| json` filter** when interpolating string variables to prevent quote-breaking.

## Hash key assignment

`hash_assign` is deprecated; `assign` writes hash keys directly.

```liquid
{% assign user["name"]["first"] = "John" %}
{% assign user["roles"] = user["roles"] | array_add: "admin" %}
```

## increment / decrement

Creates independent counter variables (separate from assign/capture).

```liquid
{% increment counter %}   → 0
{% increment counter %}   → 1
{% increment counter %}   → 2

{% decrement counter %}   → -1
{% decrement counter %}   → -2
```

Note: increment/decrement variables are independent from assign variables with the same name.

## Sharing Variables Between Partials

Since variables are local, use these patterns:

### export tag (partial → context.exports)
```liquid
{% comment %} In partial {% endcomment %}
{% export my_data, namespace: 'calculator' %}

{% comment %} In calling page {% endcomment %}
{{ context.exports.calculator.my_data }}
```

### return tag (function partial → caller)
```liquid
{% comment %} In partial called via function {% endcomment %}
{% return result %}

{% comment %} In calling page {% endcomment %}
{% function data = 'lib/helpers/calculate', input: value %}
{{ data }}
```

### Passing parameters (caller → partial)
```liquid
{% render 'products/card', product: product, show_price: true %}
{% function result = 'lib/commands/create', title: "Test" %}
```
