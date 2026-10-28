import assert from "node:assert/strict";
import { tenantBucket } from "./creator-storage.js";

assert.equal(tenantBucket("Studio Aurora"), "creator-studio-aurora");
assert.notEqual(tenantBucket("studio-aurora"), tenantBucket("studio-borealis"));
console.log("tenant bucket isolation: ok");
