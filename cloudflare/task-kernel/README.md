# Asympta Task Kernel Worker

A Cloudflare Durable Object owns one canonical `asympta.task/0.3` state per task. The worker provides a typed API; it never accepts natural-language continuation prompts for requirement answers.

## API

### Create task

`POST /v1/tasks`

```json
{
  "rootIntent": "Buy a television",
  "locale": "en-HK",
  "mode": "simulated",
  "missingFields": ["screen size", "brand preference", "delivery location"]
}
```

The response returns the task and a one-time displayed bearer `accessToken`. Only the SHA-256 token hash is stored in the Durable Object.

### Read task

`GET /v1/tasks/:taskId`

Header:

```text
Authorization: Bearer <task access token>
```

### Answer one requirement

`POST /v1/tasks/:taskId/answers`

```json
{
  "commandId": "client-generated-idempotency-key",
  "requirementId": "task-...:requirement:screen_size:0",
  "expectedRevision": 1,
  "value": "55-inch",
  "label": "55″"
}
```

A stale revision is rejected with `409 revision_conflict`. Replaying a completed `commandId` returns the existing state without adding a second mutation.

### Approve or reject a consequential action

`POST /v1/tasks/:taskId/approve`

```json
{
  "commandId": "approval-command-id",
  "approvalId": "task-...:approval:live-write",
  "expectedRevision": 17,
  "approved": true
}
```

Approval does not itself prove execution. A live task remains blocked until a connected executor returns evidence.

### Cancel

`POST /v1/tasks/:taskId/cancel`

### Event history

`GET /v1/tasks/:taskId/events?afterRevision=12`

## Security and operational properties

- exact production origin allowlist;
- bounded JSON body and string lengths;
- per-IP/client task-creation rate limit;
- opaque bearer capability token per task;
- token hash only in Durable Object storage;
- monotonic revisions;
- command idempotency;
- human-confirmed facts are locked;
- bounded delegation depth, assignment count and agent steps;
- no secret, address or payment credential is required by this API;
- no real external side effect is claimed by the built-in simulated agents;
- no request or task content is logged by the worker.

## Local testing

The worker is tested with an in-memory Durable Object namespace. Production deployment is separate from GitHub Pages:

```sh
npm run test:task-kernel-worker
npm run deploy:task-kernel
```
