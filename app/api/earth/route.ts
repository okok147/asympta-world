import { z } from "zod";

import { getSharedEarth, mergeIntoSharedEarth, type EarthSharedState } from "@/db/earth-store";

const catalogItem = z.object({
  id: z.string().max(100),
  name: z.string().max(100),
  type: z.enum(["product", "service"]),
  price: z.number().finite().nonnegative().optional(),
  availability: z.number().finite().nonnegative().optional(),
  tags: z.array(z.string().max(60)).max(12),
});
const place = z.object({
  id: z.string().max(180), name: z.string().max(100), kind: z.enum(["store", "service", "facility", "community"]),
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), cellId: z.string().max(80), summary: z.string().max(300),
  catalog: z.array(catalogItem).max(48), evidenceIds: z.array(z.string().max(180)).max(40), confidence: z.number().min(0).max(1), completeness: z.number().min(0).max(1), brightness: z.number().min(0).max(1), contributorCount: z.number().int().nonnegative(), updatedAt: z.number().int().nonnegative(),
});
const evidence = z.object({
  id: z.string().max(180), contributorId: z.string().max(120), createdAt: z.number().int().nonnegative(), updatedAt: z.number().int().nonnegative(),
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), cellId: z.string().max(80), placeName: z.string().max(100), kind: z.enum(["store", "service", "facility", "community"]), description: z.string().max(2600), imageName: z.string().max(180).optional(), imageDataUrl: z.string().max(150000).optional(), status: z.enum(["queued", "reading", "structured", "verified"]), extractedCatalog: z.array(catalogItem).max(48), linkedOpportunityId: z.string().max(180).optional(),
});
const opportunity = z.object({
  id: z.string().max(180), title: z.string().max(120), summary: z.string().max(900), kind: z.enum(["local-info", "local-service", "remote-agent", "hybrid"]),
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), cellId: z.string().max(80), placeId: z.string().max(180).optional(), rewardXp: z.number().int().min(0).max(5000), status: z.enum(["open", "claimed", "agent-working", "human-needed", "completed"]), agentTasks: z.array(z.string().max(400)).max(16), humanTasks: z.array(z.string().max(400)).max(16), agentCompleted: z.array(z.string().max(400)).max(16), humanCompleted: z.array(z.string().max(400)).max(16), handoff: z.string().max(2400).optional(), claimedBy: z.string().max(120).optional(), createdAt: z.number().int().nonnegative(), updatedAt: z.number().int().nonnegative(),
});
const sharedEarthSchema = z.object({
  version: z.literal(1), places: z.array(place).max(5000), evidence: z.array(evidence).max(6000), opportunities: z.array(opportunity).max(5000), updatedAt: z.number().int().nonnegative(),
});
const headers = { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" };

export async function GET() {
  try {
    return Response.json({ earth: await getSharedEarth(), persistence: "d1-shared" }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Shared Earth could not be loaded." }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 500_000) return Response.json({ error: "Earth sync payload is too large." }, { status: 413, headers });
    const parsed = sharedEarthSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return Response.json({ error: "Earth sync payload is invalid.", details: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, { status: 400, headers });
    const earth = await mergeIntoSharedEarth(parsed.data as EarthSharedState);
    return Response.json({ earth, persistence: "d1-shared" }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Shared Earth could not be updated." }, { status: 400, headers });
  }
}
