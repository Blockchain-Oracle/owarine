import { addressSchema } from "@owarine/core/types";
import { publishedFills, publishedReceipts } from "@owarine/db";
import { z } from "zod";
import { BadRequest, type IndexQuery } from "./queries";

/**
 * C13a: `published/<address>/{fills,receipts}`, one seat's opt-in publications (plan §5). Public: a publication is
 * the owner's own choice to show a call, and nothing unpublished is reachable here. `/u/<address>` reads it for
 * anyone but the viewer, whose own record comes from the lease-scoped `wallet/*` paths.
 */
const int = z.coerce.number().int().nonnegative();
const pageQuery = z.object({ limit: int.optional(), offset: int.optional() });

function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new BadRequest(parsed.error.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`).join("; "));
  return parsed.data;
}

export function resolvePublishedQuery(path: readonly string[], query: Record<string, string>): IndexQuery | null {
  const [head, who, resource, ...rest] = path;
  if (head !== "published" || who === undefined || rest.length > 0) return null;
  const handle = parse(addressSchema, who);
  switch (resource) {
    case "fills": {
      const q = parse(pageQuery, query);
      return { scope: "public", run: (_r, db) => publishedFills(db, handle, q) };
    }
    case "receipts": {
      const q = parse(pageQuery, query);
      return { scope: "public", run: (_r, db) => publishedReceipts(db, handle, q) };
    }
    default:
      return null;
  }
}
