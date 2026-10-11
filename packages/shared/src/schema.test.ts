import { describe, it, expect } from "vitest";
import {
  PatchSchema,
  PatchChangeSchema,
  PatchStatusSchema,
  CreatePatchSchema,
  AuditEventSchema,
  DeploymentSchema
} from "./schema.js";
import { validateChange } from "./changes.js";

describe("PatchSchema", () => {
  it("parses a valid patch successfully", () => {
    const validPatch = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      target_url: "https://example.com/page",
      base_version: 1,
      anchors: {
        cssSelector: ".header",
        xpath: "//header",
        textContent: "Welcome",
        attributes: { class: "header main" },
        parentContext: "body",
        siblingContext: ["div.nav"]
      },
      change: {
        type: "text" as const,
        value: "New Welcome"
      },
      author_id: "123e4567-e89b-12d3-a456-426614174001",
      status: "draft" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const result = PatchSchema.safeParse(validPatch);
    expect(result.success).toBe(true);
  });

  it("throws ZodError for invalid Patch (missing id)", () => {
    const invalidPatch = {
      target_url: "https://example.com/page",
      base_version: 1,
      anchors: {
        cssSelector: ".header",
        xpath: "//header",
        textContent: "Welcome",
        attributes: {},
        parentContext: "body",
        siblingContext: []
      },
      change: {
        type: "text",
        value: "New Welcome"
      },
      author_id: "123e4567-e89b-12d3-a456-426614174001",
      status: "draft",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const result = PatchSchema.safeParse(invalidPatch);
    expect(result.success).toBe(false);
  });
});

describe("PatchChangeSchema", () => {
  it("validates all 8 change types at schema level", () => {
    // original 4
    expect(PatchChangeSchema.safeParse({ type: "text", value: "x" }).success).toBe(true);
    expect(PatchChangeSchema.safeParse({ type: "style", value: "x" }).success).toBe(true);
    expect(PatchChangeSchema.safeParse({ type: "visibility", value: "x" }).success).toBe(true);
    expect(PatchChangeSchema.safeParse({ type: "script", value: "x" }).success).toBe(true);
    // new 4
    expect(PatchChangeSchema.safeParse({ type: "attribute", value: '{"name":"href","value":"https://example.com"}' }).success).toBe(true);
    expect(PatchChangeSchema.safeParse({ type: "attribute", value: '{"name":"alt","remove":true}' }).success).toBe(true);
    expect(PatchChangeSchema.safeParse({ type: "remove", value: "remove" }).success).toBe(true);
    expect(PatchChangeSchema.safeParse({
      type: "move",
      value: '{"to":"before","ref":{"cssSelector":"h1","xpath":"","textContent":"","attributes":{},"parentContext":"","siblingContext":[]}}',
    }).success).toBe(true);
    expect(PatchChangeSchema.safeParse({ type: "behavior", value: '{"action":"navigate","url":"https://example.com"}' }).success).toBe(true);
    expect(PatchChangeSchema.safeParse({ type: "behavior", value: '{"action":"disable"}' }).success).toBe(true);
    expect(PatchChangeSchema.safeParse({ type: "behavior", value: '{"action":"confirm","message":"Are you sure?"}' }).success).toBe(true);
  });

  it("rejects invalid change type", () => {
    expect(PatchChangeSchema.safeParse({ type: "html", value: "x" }).success).toBe(false);
    expect(PatchChangeSchema.safeParse({ type: "delete", value: "x" }).success).toBe(false);
    expect(PatchChangeSchema.safeParse({ type: "", value: "x" }).success).toBe(false);
  });
});

describe("validateChange — attribute", () => {
  it("accepts a valid attribute set", () => {
    const r = validateChange({ type: "attribute", value: '{"name":"href","value":"https://ok.com"}' });
    expect(r.ok).toBe(true);
  });

  it("rejects a blocked on* attribute", () => {
    const r = validateChange({ type: "attribute", value: '{"name":"onclick","value":"alert(1)"}' });
    expect(r.ok).toBe(false);
  });

  it("rejects a blocked style/id/srcdoc/is attribute", () => {
    expect(validateChange({ type: "attribute", value: '{"name":"style","value":"color:red"}' }).ok).toBe(false);
    expect(validateChange({ type: "attribute", value: '{"name":"id","value":"foo"}' }).ok).toBe(false);
  });

  it("rejects bad JSON", () => {
    expect(validateChange({ type: "attribute", value: "not-json" }).ok).toBe(false);
  });
});

describe("validateChange — remove", () => {
  it("accepts value 'remove'", () => {
    expect(validateChange({ type: "remove", value: "remove" }).ok).toBe(true);
  });

  it("rejects any other value", () => {
    expect(validateChange({ type: "remove", value: "delete" }).ok).toBe(false);
  });
});

describe("validateChange — move", () => {
  const refAnchor = { cssSelector: "#target", xpath: "", textContent: "", attributes: {}, parentContext: "", siblingContext: [] };

  it("accepts all valid placements", () => {
    for (const to of ["before", "after", "first", "last"]) {
      expect(validateChange({ type: "move", value: JSON.stringify({ to, ref: refAnchor }) }).ok).toBe(true);
    }
  });

  it("rejects invalid placement", () => {
    expect(validateChange({ type: "move", value: JSON.stringify({ to: "inside", ref: refAnchor }) }).ok).toBe(false);
  });

  it("rejects missing ref", () => {
    expect(validateChange({ type: "move", value: JSON.stringify({ to: "before" }) }).ok).toBe(false);
  });
});

describe("validateChange — behavior", () => {
  it("accepts navigate with safe URL", () => {
    expect(validateChange({ type: "behavior", value: '{"action":"navigate","url":"https://example.com"}' }).ok).toBe(true);
  });

  it("rejects navigate with javascript: URL", () => {
    expect(validateChange({ type: "behavior", value: '{"action":"navigate","url":"javascript:alert(1)"}' }).ok).toBe(false);
  });

  it("accepts disable", () => {
    expect(validateChange({ type: "behavior", value: '{"action":"disable"}' }).ok).toBe(true);
  });

  it("rejects confirm without message", () => {
    expect(validateChange({ type: "behavior", value: '{"action":"confirm","message":""}' }).ok).toBe(false);
  });

  it("rejects unknown action", () => {
    expect(validateChange({ type: "behavior", value: '{"action":"explode"}' }).ok).toBe(false);
  });
});

describe("PatchStatusSchema", () => {
  it("accepts all valid values", () => {
    const statuses = ["draft", "approved", "live", "broken", "healed"];
    statuses.forEach(status => {
      expect(PatchStatusSchema.safeParse(status).success).toBe(true);
    });
  });

  it("rejects invalid values", () => {
    expect(PatchStatusSchema.safeParse("unknown").success).toBe(false);
  });
});

describe("CreatePatchSchema", () => {
  it("omits id/timestamps/status correctly", () => {
    const createPatch = {
      target_url: "https://example.com",
      base_version: 0,
      anchors: {
        cssSelector: ".a",
        xpath: "//a",
        textContent: "b",
        attributes: {},
        parentContext: "c",
        siblingContext: []
      },
      change: { type: "text" as const, value: "d" },
      author_id: "123e4567-e89b-12d3-a456-426614174001"
    };
    const result = CreatePatchSchema.safeParse(createPatch);
    expect(result.success).toBe(true);
  });
});

describe("AuditEventSchema", () => {
  it("validates correctly", () => {
    const event = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      actor_id: "123e4567-e89b-12d3-a456-426614174001",
      event_type: "patch_created" as const,
      entity_id: "123e4567-e89b-12d3-a456-426614174002",
      details: { any: "detail" },
      created_at: new Date().toISOString()
    };
    expect(AuditEventSchema.safeParse(event).success).toBe(true);
  });
});

describe("DeploymentSchema", () => {
  it("validates with null rolled_back_at", () => {
    const deployment = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      version_id: "123e4567-e89b-12d3-a456-426614174001",
      is_live: true,
      canary_percent: 100,
      deployed_at: new Date().toISOString(),
      rolled_back_at: null
    };
    expect(DeploymentSchema.safeParse(deployment).success).toBe(true);
  });
});
