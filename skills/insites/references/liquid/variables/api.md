# Liquid Variables: API Reference

Complete API reference for variable operations in Insites Liquid.

## assign Tag API

### Basic Assignment
```liquid
{%- assign name = value -%}
```

Assigns value to variable. Overwrites previous value if exists.

### String Assignment
```liquid
{%- assign greeting = 'Hello World' -%}
{%- assign message = "Welcome" -%}
```

Both single and double quotes supported.

### Number Assignment
```liquid
{%- assign count = 42 -%}
{%- assign ratio = 3.14159 -%}
```

### Expression Assignment
```liquid
{%- assign result = value1 | filter1 | filter2 -%}
{%- assign total = product.price | times: quantity -%}
{%- assign text = greeting | append: name | upcase -%}
```

Expressions evaluated before assignment.

### Array Assignment
```liquid
{%- assign colors = 'red,green,blue' | split: ',' -%}
{%- assign items = collection -%}
```

### Hash Assignment
```liquid
{%- assign user = page.users | first -%}
{%- assign config = default_config | hash_merge: overrides -%}
```

## capture Tag API

### Basic Capture
```liquid
{%- capture output -%}
  Content here
  Multiple lines
{%- endcapture -%}
```

Captures content as string, strips surrounding whitespace.

### Capture with Variables
```liquid
{%- capture message -%}
  Hello {{ user.name }}!
  You have {{ items.size }} items.
{%- endcapture -%}
```

Interpolations processed during capture.

### Capture with Logic
```liquid
{%- capture status -%}
  {%- if user.active -%}
    Active
  {%- else -%}
    Inactive
  {%- endif -%}
{%- endcapture -%}
```

Full Liquid syntax available inside capture.

### Nested Captures
```liquid
{%- capture inner -%}
  Inner content
{%- endcapture -%}
{%- capture outer -%}
  Outer {{ inner }} nested
{%- endcapture -%}
```

Captured variables accessible within next capture.

## parse_json Tag API

### Static JSON
```liquid
{%- parse_json data -%}
{
  "name": "John",
  "age": 30,
  "active": true,
  "tags": ["admin", "user"]
}
{%- endparse_json -%}
```

Creates object from JSON block.

### Nested JSON Objects
```liquid
{%- parse_json config -%}
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "credentials": {
      "user": "admin",
      "password": "secret"
    }
  },
  "cache": {
    "ttl": 3600,
    "enabled": true
  }
}
{%- endparse_json -%}

{{ config.database.host }}
{{ config.database.credentials.user }}
{{ config.cache.ttl }}
```

### JSON Array
```liquid
{%- parse_json colors -%}
["red", "green", "blue", "yellow"]
{%- endparse_json -%}

{%- for color in colors -%}
  <p>{{ color }}</p>
{%- endfor -%}
```

### Array of Objects
```liquid
{%- parse_json users -%}
[
  { "id": 1, "name": "Alice", "role": "admin" },
  { "id": 2, "name": "Bob", "role": "user" },
  { "id": 3, "name": "Carol", "role": "moderator" }
]
{%- endparse_json -%}
```

## parse_json Filter API

### Basic Parse Filter
```liquid
{%- assign data = json_string | parse_json -%}
```

Parses JSON string to object/array.

### With Validation
```liquid
{%- if json_string | is_json_valid -%}
  {%- assign data = json_string | parse_json -%}
{%- endif -%}
```

### In JSON Context with json Filter
```liquid
{%- capture json_data -%}
{
  "user_id": {{ user.id | json }},
  "name": {{ user.name | json }},
  "email": {{ user.email | json }},
  "created": {{ user.created_at | json }}
}
{%- endcapture -%}
{%- assign parsed = json_data | parse_json -%}
```

Always use `| json` when interpolating into JSON strings.

### Chained Parsing
```liquid
{%- assign data = raw_json | parse_json -%}
{%- assign specific = data | hash_dig: 'settings', 'theme' -%}
```

## hash_assign Tag API

### Basic Hash Assignment
```liquid
{%- hash_assign my_hash['key'] = value -%}
```

Assigns value to hash key. Creates hash if doesn't exist.

### Nested Hash Assignment
```liquid
{%- hash_assign user['profile']['address']['city'] = 'New York' -%}
```

Creates nested structure if needed.

### Hash Assignment from Variables
```liquid
{%- assign new_value = 'updated' -%}
{%- hash_assign config['setting'] = new_value -%}
```

### Multiple Assignments
```liquid
{%- hash_assign user['name'] = 'John' -%}
{%- hash_assign user['email'] = 'john@example.com' -%}
{%- hash_assign user['active'] = true -%}
```

## increment/decrement API

### increment Tag
```liquid
{%- increment counter -%}
{%- increment page_views -%}
{%- increment total_sales -%}
```

Auto-increments variable by 1. Creates if doesn't exist (starts at 0).

Returns the new value. Persists across template.

### decrement Tag
```liquid
{%- decrement countdown -%}
{%- decrement remaining_slots -%}
```

Auto-decrements variable by 1. Creates if doesn't exist (starts at 0).

### Loop Counter
```liquid
{%- for item in items -%}
  Item {{ increment loop_counter }}: {{ item }}
{%- endfor -%}
```

Creates item counter.

### Resetting Counters
```liquid
{%- assign counter = 0 -%}
{%- for item in items -%}
  {%- assign counter = counter | plus: 1 -%}
  Item {{ counter }}: {{ item }}
{%- endfor -%}
```

Reset using assign.

## json Filter API

### Converting to JSON
```liquid
{{ object | json }}
{{ array | json }}
{{ hash | json }}
```

Converts variable to JSON string representation.

### In HTML Attributes
```liquid
<script>
  var data = {{ object | json }};
</script>
```

Always use in script blocks to ensure valid JSON.

### In Data Attributes
```liquid
<div data-config='{{ config | json }}'>
  Content
</div>
```

Escapes quotes properly for HTML.

## export API

### Exporting Variables
```liquid
{%- assign admin = is_admin -%}
{%- export user, admin, message, namespace: 'account' -%}
```

`export` takes variable names (not assignments) and an optional `namespace`, and stores them in `context.exports` for the rest of the request. It creates no variables in the caller.

### Accessing Exported Data
```liquid
{{ context.exports.account.user.name }}
{{ context.exports.account.admin }}
{{ context.exports.account.message }}
```

## return API

### Returning from Partial
```liquid
{%- return result_value -%}
```

Ends the partial and hands the value to the `{% function %}` tag that called it. It does not write to `context.exports`, and `render` and `include` ignore it.

### Return with Data
```liquid
{%- assign calculated = input | plus: 100 -%}
{%- return calculated -%}
```

## Variable Access Patterns

### Accessing Array Elements
```liquid
{{ items[0] }}
{{ items[1] }}
{{ items[array_index] }}
```

### Accessing Hash Properties
```liquid
{{ user.name }}
{{ user['email'] }}
{{ user[dynamic_key] }}
```

### Safe Access with default
```liquid
{{ user.email | default: 'no-email' }}
{{ items[0] | default: {} }}
```

## See Also

- [Variables Configuration](configuration.md)
- [Variables Patterns & Examples](patterns.md)
- [Common Gotchas](gotchas.md)
- [Advanced Techniques](advanced.md)
