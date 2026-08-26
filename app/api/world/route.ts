import { z } from "zod";

import {
  executeWorldCommand,
  getAuthoritativeWorld,
} from "@/db/world-store";

const skill = z.enum([
  "visual-design",
  "frontend",
  "copywriting",
  "research",
  "branding",
  "data-analysis",
  "qa",
  "automation",
  "product-strategy",
]);

const idempotencyKey = z.string().trim().min(8).max(120);
const participantId = z.string().trim().min(2).max(80);

const commandSchema = z.discriminatedUnion("type", [
  z.object({
    idempotencyKey,
    type: z.literal("post_need"),
    origin: z.enum(["human", "webmcp-agent"]),
    participantId,
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(3).max(600),
    budget: z.number().finite().min(10).max(10000),
    deadline: z.string().trim().max(80).optional(),
    requiredSkills: z.array(skill).max(4).optional(),
  }),
  z.object({
    idempotencyKey,
    type: z.literal("create_offer"),
    origin: z.literal("webmcp-agent"),
    agentId: participantId,
    needId: participantId,
    price: z.number().finite().min(1).max(10000),
    message: z.string().trim().min(3).max(500),
    collaboratorIds: z.array(participantId).max(4).optional(),
  }),
  z.object({
    idempotencyKey,
    type: z.literal("accept_offer"),
    origin: z.enum(["human", "webmcp-agent"]),
    participantId,
    offerId: participantId,
  }),
  z.object({
    idempotencyKey,
    type: z.literal("send_message"),
    origin: z.enum(["human", "webmcp-agent"]),
    fromId: participantId,
    toId: participantId,
    body: z.string().trim().min(1).max(500),
    needId: participantId.optional(),
  }),
  z.object({
    idempotencyKey,
    type: z.literal("create_business"),
    origin: z.literal("webmcp-agent"),
    agentId: participantId,
    name: z.string().trim().min(3).max(80),
    specialty: z.array(skill).min(1).max(4),
    reason: z.string().trim().min(6).max(500),
  }),
  z.object({
    idempotencyKey,
    type: z.literal("join_business"),
    origin: z.literal("webmcp-agent"),
    agentId: participantId,
    businessId: participantId,
  }),
]);

const responseHeaders = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
};

export async function GET() {
  try {
    const world = await getAuthoritativeWorld();
    return Response.json(
      { world, persistence: "d1-shared" },
      { headers: responseHeaders },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The world could not be loaded.",
      },
      { status: 503, headers: responseHeaders },
    );
  }
}

export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 20000) {
      return Response.json(
        { error: "The command is too large." },
        { status: 413, headers: responseHeaders },
      );
    }
    const parsed = commandSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      return Response.json(
        {
          error: "That world action is not valid.",
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400, headers: responseHeaders },
      );
    }
    const world = await executeWorldCommand(parsed.data);
    return Response.json(
      { world, persistence: "d1-shared" },
      { headers: responseHeaders },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The world action could not be completed.",
      },
      { status: 400, headers: responseHeaders },
    );
  }
}
