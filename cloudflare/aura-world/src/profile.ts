import { DurableObject } from 'cloudflare:workers';

type Growth = { schema: number; abilities: number[]; updatedAt: number };
export type CircleIdentity = { circleID: string; actor: string };
type CircleIndex = Record<string, string>;
type PendingErasure = { attempts: number; due: number };
type RemovalState = {
  phase: 'removing' | 'removed';
  pending: Record<string, PendingErasure>;
};
type Failure = {
  error: 'identity_removed' | 'circle_index_full' | 'invalid_input' | 'circle_actor_conflict';
  status: number;
};
export type RemovalStatus = {
  status: 'active' | 'removing' | 'removed';
  remaining: number;
  completed: number;
  scope: 'indexed_and_supplied_circles';
  legacyUnknownPossible: true;
  scopeWarning: string;
  retainedMetadata: string;
  independentData: string;
};

const INDEX_KEY = 'identity-circle-index-v1';
const REMOVAL_KEY = 'identity-removal-v1';
const INDEX_LIMIT = 1024;
const BATCH_SIZE = 8;
const CIRCLE_ID = /^[0-9a-f]{32}$/;
const ACTOR_ID = /^[0-9a-f]{64}$/;
const revoked = (): Failure => ({ error: 'identity_removed', status: 410 });
const emptyGrowth = (): Growth => ({ schema: 1, abilities: [0, 0, 0, 0, 0], updatedAt: 0 });

/**
 * The existing capability-scoped profile DO, with additive private removal data.
 * Keep the original growth key and maximum-merge semantics for existing clients.
 * No raw credential, personal content, geography, or presence index is stored here.
 */
export class AuraProfile extends DurableObject<Env> {
  async isRevoked(): Promise<boolean> {
    return (await this.ctx.storage.get<RemovalState>(REMOVAL_KEY)) !== undefined;
  }

  async read(): Promise<Growth | Failure> {
    return this.ctx.storage.transaction(async txn => {
      if (await txn.get<RemovalState>(REMOVAL_KEY)) return revoked();
      return (await txn.get<Growth>('growth')) || emptyGrowth();
    });
  }

  async merge(abilities: number[]): Promise<Growth | Failure> {
    return this.ctx.storage.transaction(async txn => {
      // A PUT already admitted by the Worker must not resurrect removed growth.
      if (await txn.get<RemovalState>(REMOVAL_KEY)) return revoked();
      if (!Array.isArray(abilities) || abilities.length !== 5 ||
          abilities.some(n => !Number.isSafeInteger(n) || n < 0 || n > 10000000)) {
        throw Error('invalid_abilities');
      }
      const old = (await txn.get<Growth>('growth')) || emptyGrowth();
      const result: Growth = {
        schema: 1,
        abilities: abilities.map((n, i) => Math.max(n, old.abilities[i])),
        updatedAt: Date.now(),
      };
      await txn.put('growth', result);
      return result;
    });
  }

  private expandIndex(index: CircleIndex, pairs: CircleIdentity[], maximum: number): { index: CircleIndex } | Failure {
    if (!Array.isArray(pairs) || pairs.length > maximum) return { error: 'invalid_input', status: 400 };
    const seen = new Set<string>();
    const merged: CircleIndex = { ...index };
    for (const pair of pairs) {
      if (!pair || typeof pair !== 'object' ||
          typeof pair.circleID !== 'string' || !CIRCLE_ID.test(pair.circleID) ||
          typeof pair.actor !== 'string' || !ACTOR_ID.test(pair.actor) || seen.has(pair.circleID)) {
        return { error: 'invalid_input', status: 400 };
      }
      seen.add(pair.circleID);
      if (merged[pair.circleID] !== undefined && merged[pair.circleID] !== pair.actor) {
        return { error: 'circle_actor_conflict', status: 409 };
      }
      merged[pair.circleID] = pair.actor;
    }
    if (Object.keys(merged).length > INDEX_LIMIT) return { error: 'circle_index_full', status: 409 };
    return { index: merged };
  }

  /** Trusted Worker-derived mappings only; called before every circle dispatch. */
  async reserveCircles(pairs: CircleIdentity[]): Promise<{ ok: true } | Failure> {
    return this.ctx.storage.transaction(async txn => {
      if (await txn.get<RemovalState>(REMOVAL_KEY)) return revoked();
      const index = (await txn.get<CircleIndex>(INDEX_KEY)) || {};
      const expanded = this.expandIndex(index, pairs, 8);
      if ('error' in expanded) return expanded;
      if (Object.keys(expanded.index).length !== Object.keys(index).length) {
        await txn.put(INDEX_KEY, expanded.index);
      }
      return { ok: true } as const;
    });
  }

  private stateWithPending(pending: Record<string, PendingErasure>): RemovalState {
    return { phase: Object.keys(pending).length ? 'removing' : 'removed', pending };
  }

  private statusFor(index: CircleIndex, removal: RemovalState | undefined): RemovalStatus {
    const remaining = removal ? Object.keys(removal.pending).length : 0;
    return {
      status: removal ? (remaining ? 'removing' : 'removed') : 'active',
      remaining,
      completed: removal ? Object.keys(index).length - remaining : 0,
      scope: 'indexed_and_supplied_circles',
      legacyUnknownPossible: true,
      scopeWarning: 'Historical circles absent from supplied links and untouched since index launch cannot be discovered. Removed means the indexed and supplied work is complete, not that all historical global data is gone.',
      retainedMetadata: 'Minimal opaque root revocation, circle mappings, actor tombstones, retry and idempotency metadata remains. Revocation records contain no personal content.',
      independentData: 'Device data, copied files, recovery exports, external backups and Apple subscriptions are independent of this backend operation.',
    };
  }

  /** Storage operations only: schedule and state changes commit together. */
  private async schedule(txn: DurableObjectTransaction, removal: RemovalState, acknowledge = false): Promise<void> {
    const entries = Object.values(removal.pending);
    if (!entries.length) {
      // Even an empty confirmed removal commits a durable alarm before its ack.
      if (acknowledge) await txn.setAlarm(Date.now() + 1);
      else await txn.deleteAlarm();
      return;
    }
    let earliest = Infinity;
    for (const entry of entries) earliest = Math.min(earliest, entry.due);
    await txn.setAlarm(Math.max(Date.now() + 1, earliest));
  }

  /** Invoked only after the Worker validates the explicit confirmation. */
  async beginRemoval(pairs: CircleIdentity[]): Promise<RemovalStatus | Failure> {
    return this.ctx.storage.transaction(async txn => {
      const index = (await txn.get<CircleIndex>(INDEX_KEY)) || {};
      const previous = await txn.get<RemovalState>(REMOVAL_KEY);
      const expanded = this.expandIndex(index, pairs, 512);
      if ('error' in expanded) return expanded;
      const pending: Record<string, PendingErasure> = previous ? { ...previous.pending } : {};
      const now = Date.now();
      for (const circleID of Object.keys(expanded.index)) {
        // Previously completed entries are not recounted or requeued. New legacy
        // entries can resume the same desired state even after phase=removed.
        if (!previous || index[circleID] === undefined) pending[circleID] = { attempts: 0, due: now };
      }
      const removal = this.stateWithPending(pending);
      await txn.put(INDEX_KEY, expanded.index);
      await txn.put(REMOVAL_KEY, removal);
      await txn.delete('growth');
      await this.schedule(txn, removal, true);
      return this.statusFor(expanded.index, removal);
    });
  }

  async removalStatus(): Promise<RemovalStatus> {
    return this.ctx.storage.transaction(async txn => {
      const index = (await txn.get<CircleIndex>(INDEX_KEY)) || {};
      const removal = await txn.get<RemovalState>(REMOVAL_KEY);
      if (removal && Object.keys(removal.pending).length) await this.schedule(txn, removal);
      return this.statusFor(index, removal);
    });
  }

  private async claimBatch(): Promise<CircleIdentity[]> {
    return this.ctx.storage.transaction(async txn => {
      const removal = await txn.get<RemovalState>(REMOVAL_KEY);
      if (!removal) return [];
      const index = (await txn.get<CircleIndex>(INDEX_KEY)) || {};
      const now = Date.now();
      const pending = { ...removal.pending };
      const selected = Object.keys(pending)
        .filter(circleID => pending[circleID].due <= now)
        .sort((a, b) => pending[a].due - pending[b].due || a.localeCompare(b))
        .slice(0, BATCH_SIZE);
      const batch: CircleIdentity[] = [];
      for (const circleID of selected) {
        const attempts = Math.min(32, pending[circleID].attempts + 1);
        // Persist the next retry before external RPC. Provider retries are not
        // the work queue; ordinary erasure failures resolve with this alarm set.
        const delay = Math.min(60 * 60 * 1000, 30_000 * 2 ** Math.min(attempts - 1, 7));
        pending[circleID] = { attempts, due: now + delay };
        batch.push({ circleID, actor: index[circleID] });
      }
      const next = this.stateWithPending(pending);
      await txn.put(REMOVAL_KEY, next);
      await this.schedule(txn, next);
      return batch;
    });
  }

  private async completeErasure(circleID: string, actor: string): Promise<void> {
    await this.ctx.storage.transaction(async txn => {
      // Always re-read current state: POST may have appended legacy entries
      // while the erasure RPC awaited, or another delivery may have completed it.
      const removal = await txn.get<RemovalState>(REMOVAL_KEY);
      if (!removal) return;
      const index = (await txn.get<CircleIndex>(INDEX_KEY)) || {};
      const pending = { ...removal.pending };
      if (index[circleID] === actor && pending[circleID] !== undefined) delete pending[circleID];
      const next = this.stateWithPending(pending);
      await txn.put(REMOVAL_KEY, next);
      await this.schedule(txn, next);
      // Completion counts are derived from durable sets, never incremented.
    });
  }

  private async rearm(): Promise<void> {
    await this.ctx.storage.transaction(async txn => {
      const removal = await txn.get<RemovalState>(REMOVAL_KEY);
      if (removal) await this.schedule(txn, removal);
    });
  }

  private async eraseOne(pair: CircleIdentity): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Bound an alarm delivery without assuming that timing out cancels RPC.
      // A late success remains harmless because circle tombstones are permanent.
      const result = await Promise.race([
        this.env.CIRCLES.getByName(pair.circleID).eraseIdentity(pair.actor),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(Error('erasure_timeout')), 25_000);
        }),
      ]);
      if (!result || result.ok !== true) throw Error('erasure_failed');
      await this.completeErasure(pair.circleID, pair.actor);
    } catch {
      // No identifiers or provider errors: those can contain private data.
      console.warn(JSON.stringify({ event: 'identity_erasure_retry_pending', kind: 'runtime' }));
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  async alarm(): Promise<void> {
    try {
      const batch = await this.claimBatch();
      // At most eight erasures; no external I/O occurs in a storage transaction.
      await Promise.all(batch.map(pair => this.eraseOne(pair)));
      await this.rearm();
    } catch {
      console.warn(JSON.stringify({ event: 'identity_removal_alarm_retry', kind: 'storage_or_runtime' }));
      // If storage itself is unavailable, let this throw for provider retries.
      // Otherwise the application-owned alarm survives beyond their six retries.
      await this.rearm();
    }
  }
}
