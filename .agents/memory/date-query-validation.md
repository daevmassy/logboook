---
name: Date-only API query validation
description: How generated Zod query schemas treat OpenAPI date query parameters.
---

OpenAPI query parameters declared as `type: string, format: date` remain date-only strings on the HTTP wire, but this workspace's generated server Zod validators require JavaScript `Date` instances. Normalize valid `YYYY-MM-DD` values at the server boundary before calling `safeParse`; reject malformed calendar dates rather than allowing JavaScript to roll them into another month.

**Why:** Express delivers query parameters as strings, so passing them directly to the generated validators produces an `invalid_type` 400 even when the request matches the OpenAPI contract.

**How to apply:** Use the shared date-query normalizer for generated query validators. Keep clients sending `YYYY-MM-DD` strings and do not edit generated files.
