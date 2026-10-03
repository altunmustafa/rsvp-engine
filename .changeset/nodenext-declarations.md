---
"@rsvp-engine/core": patch
---

Fix TypeScript declaration compatibility for NodeNext consumers. Bundle declarations into separate ESM and CommonJS entry points so package-internal extensionless imports no longer cause type-resolution errors.
