import { DurableObject } from 'cloudflare:workers';
import { circlePhoto } from './circle-photo';

const HEX_ID = /^[0-9a-f]{32}$/;
const MEMBER_ID = /^[0-9a-f]{64}$/;
const MEMBER_LIMIT = 32;
const MOMENT_LIMIT = 256;
const REPLY_LIMIT = 100;
const HISTORY_LIMIT = 20_000;
const WRITE_WINDOW_MS = 60_000;
const WRITE_LIMIT = 18;
const REPORT_REASONS = ['harassment', 'spam', 'privacy', 'other'] as const;
const REPORT_REASON_COLUMN = `reason TEXT NOT NULL DEFAULT 'other'
  CHECK(reason IN (${REPORT_REASONS.map(reason => `'${reason}'`).join(', ')}))`;

type Kind = 'moment' | 'reply';
type ReportReason = typeof REPORT_REASONS[number];
type Action = 'create' | 'join' | 'snapshot' | 'invite' | 'publish' | 'detail' | 'reply' |
  'reaction' | 'read' | 'moderate' | 'reports' | 'resolve' | 'blocks' | 'unblock' | 'leave' |
  'members' | 'removeMember' | 'rotateInvite' | 'appearance' | 'momentReport' | 'replyReport';
type Input = Record<string, unknown>;
type MemberStyle = 'clay' | 'saffron' | 'tide' | 'dusk';
type Member = { id: string; name: string; style?: MemberStyle | null };
type AuthorColumns = { authorName: string; authorStyle: MemberStyle | null };
type CircleRow = { title: string; owner: string; secret: string; closed: number; lastEventAt: number };
type ContributionRow = { id: string; author: string; text: string; createdAt: number };
type MomentRow = ContributionRow & { region: string | null; photo: string | null; photoDescription: string | null };
type ReplyRow = ContributionRow & { momentID: string };
type SummaryRow = Omit<MomentRow, 'photo'> & AuthorColumns & { hasPhoto: number; replyCount: number; reactionCount: number; reacted: number };
type FullReplyRow = ReplyRow & AuthorColumns;
type ReportRow = ContributionRow & AuthorColumns & Record<ReportReason, number> & { reportCount: number };
type Result = { status: number; body: object };

const routes = new Map<string, Action>([
  ['POST /create', 'create'], ['POST /join', 'join'], ['GET ', 'snapshot'], ['GET /', 'snapshot'],
  ['GET /invite', 'invite'], ['POST /moments', 'publish'], ['POST /read', 'read'],
  ['POST /moderate', 'moderate'], ['GET /reports', 'reports'], ['POST /resolve', 'resolve'],
  ['GET /blocks', 'blocks'], ['POST /unblock', 'unblock'], ['POST /leave', 'leave'],
  ['GET /members', 'members'], ['POST /members/remove', 'removeMember'], ['POST /invite/rotate', 'rotateInvite'],
  ['POST /appearance', 'appearance'],
]);

export function matchCircleRoute(path: string, method: string) {
  const match = /^\/v1\/circles\/([0-9a-f]{32})(.*)$/.exec(path);
  if (!match) return null;
  const [, circleID, suffix] = match;
  const action = routes.get(`${method} ${suffix}`);
  if (action) return { circleID, action, target: null };
  const report = /^\/reports\/(moment|reply)\/([0-9a-f]{32})$/.exec(suffix);
  if (method === 'GET' && report) {
    return {
      circleID, action: report[1] === 'moment' ? 'momentReport' as const : 'replyReport' as const,
      target: report[2],
    };
  }
  const moment = /^\/moments\/([0-9a-f]{32})(?:\/(replies|reaction))?$/.exec(suffix);
  if (!moment) return null;
  const [, target, subresource] = moment;
  if (method === 'GET' && !subresource) return { circleID, action: 'detail' as const, target };
  if (method === 'POST' && subresource) {
    return { circleID, action: subresource === 'replies' ? 'reply' as const : 'reaction' as const, target };
  }
  return null;
}

class CircleFailure extends Error {
  constructor(readonly status: number, code: string) {
    super(code);
  }
}
function fail(status: number, code: string): never {
  throw new CircleFailure(status, code);
}
const done = { ok: true };
const opaqueID = () => crypto.randomUUID().replaceAll('-', '');

function authorJSON(row: AuthorColumns & { author: string }): Member {
  return { id: row.author, name: row.authorName, style: row.authorStyle };
}

function id(value: unknown, pattern = HEX_ID): string {
  if (typeof value !== 'string' || !pattern.test(value)) return fail(400, 'invalid_input');
  return value;
}
function text(value: unknown, maximum: number, allowEmpty = false, multiline = false): string {
  if (typeof value !== 'string' || value.length > maximum * 4) return fail(400, 'invalid_text');
  const clean = value.replace(/\r\n/g, '\n').trim();
  const forbidden = multiline
    ? /[\x00-\x08\x0b-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/u
    : /[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/u;
  if ((!allowEmpty && !clean) || [...clean].length > maximum || forbidden.test(clean)) {
    return fail(400, 'invalid_text');
  }
  // First-line filter for direct threats. Human reports handle context and media.
  if (/\b(?:kill yourself|i(?:['’]ll| will) kill you)\b|我要殺了你|我要杀了你|お前を殺す|自殺しろ/iu.test(clean.normalize('NFKC'))) {
    return fail(422, 'filtered');
  }
  return clean;
}
function region(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !/^-?\d{1,5}:-?\d{1,4}$/.test(value)) return fail(400, 'invalid_region');
  const [x, y] = value.split(':').map(Number);
  if (Math.abs(x) > 12524 || Math.abs(y) > 8946) return fail(400, 'invalid_region');
  return `${x}:${y}`;
}
function kind(value: unknown): Kind {
  if (value === 'moment' || value === 'reply') return value;
  return fail(400, 'invalid_input');
}
function reportReason(value: unknown): ReportReason {
  if (value === undefined || value === null) return 'other';
  const reason = REPORT_REASONS.find(reason => reason === value);
  return reason ?? fail(400, 'invalid_input');
}
function sameSecret(expected: string, supplied: string): boolean {
  let difference = 0;
  for (let index = 0; index < expected.length; index++) {
    difference |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  }
  return difference === 0;
}

// In every query using these predicates, ?1 is the authenticated viewer.
function unblocked(author: string) {
  return `NOT EXISTS (
    SELECT 1 FROM blocks WHERE blocker=?1 AND blocked=${author}
    UNION ALL
    SELECT 1 FROM blocks WHERE blocker=${author} AND blocked=?1
  )`;
}
function visible(alias: string, type: Kind) {
  return `${unblocked(`${alias}.author`)} AND NOT EXISTS (
    SELECT 1 FROM reports WHERE kind='${type}' AND target=${alias}.id AND reporter=?1
  )`;
}

const momentSummary = `
  SELECT m.id, m.author, a.name AS authorName, a.style AS authorStyle, m.text, m.createdAt, m.region, m.photoDescription,
    m.photo IS NOT NULL AS hasPhoto,
    (SELECT count(*) FROM replies r WHERE r.momentID=m.id AND ${visible('r', 'reply')}) AS replyCount,
    (SELECT count(*) FROM reactions k WHERE k.momentID=m.id AND ${unblocked('k.author')}) AS reactionCount,
    EXISTS (SELECT 1 FROM reactions k WHERE k.momentID=m.id AND k.author=?1) AS reacted
  FROM moments m JOIN members a ON a.id=m.author
  WHERE ${visible('m', 'moment')}`;

export class WorldCircle extends DurableObject {
  private get sql() { return this.ctx.storage.sql; }

  dispatch(circleID: string, actor: string, action: Action, target: string | null, raw: unknown): Result {
    try {
      const input = raw === null ? {} : raw;
      if (typeof input !== 'object' || Array.isArray(input)) return fail(400, 'invalid_input');
      const body = this.run(circleID, actor, action, target, input as Input);
      return { status: 200, body };
    } catch (error) {
      if (error instanceof CircleFailure) return { status: error.status, body: { error: error.message } };
      if (error instanceof Error && error.message === 'invalid_photo') {
        return { status: 400, body: { error: 'invalid_photo' } };
      }
      // SQL/runtime errors can contain content or identifiers. Keep them inside the object.
      console.error(JSON.stringify({ event: 'circle_request_failed', action, kind: 'runtime' }));
      return { status: 503, body: { error: 'temporarily_unavailable' } };
    }
  }

  private run(circleID: string, actor: string, action: Action, target: string | null, input: Input): object {
    const circle = this.circle();
    if (action === 'create') return this.create(circleID, actor, input, circle);
    // A leave retry after a lost response is harmless even if the circle is closed.
    if (action === 'leave' && (!circle || circle.closed || !this.member(actor))) return done;
    if (!circle || circle.closed) return fail(404, 'circle_not_found');
    if (action === 'join') return this.join(circleID, actor, input, circle);
    const member = this.member(actor);
    if (!member) return fail(403, 'not_member');

    switch (action) {
      case 'snapshot': return this.snapshot(circleID, member, circle);
      case 'invite':
        this.requireHost(circle, actor);
        return { code: `${circleID}.${circle.secret}` };
      case 'detail': return this.detail(actor, target);
      case 'reports':
      case 'momentReport':
      case 'replyReport':
        this.requireHost(circle, actor);
        this.ensureReportReasons();
        if (action === 'reports') return this.reports(actor);
        return this.reportDetail(actor, action === 'momentReport' ? 'moment' : 'reply', target);
      case 'blocks': return this.blocks(actor);
      case 'members':
        this.requireHost(circle, actor);
        // This roster is a host-only access-control surface, independent of feed blocks.
        return { members: this.sql.exec<Member>('SELECT id, name, style FROM members ORDER BY joinedAt, id').toArray() };
    }

    if (action === 'moderate' && input.action === 'report') this.ensureReportReasons();
    return this.ctx.storage.transactionSync(() => {
      switch (action) {
        case 'publish': return this.publish(actor, input);
        case 'reply': return this.reply(actor, target, input);
        case 'reaction': return this.reaction(actor, target, input);
        case 'read': return this.markRead(actor, input);
        case 'moderate': return this.moderate(actor, circle, input);
        case 'resolve':
          this.requireHost(circle, actor);
          return this.resolve(actor, input);
        case 'unblock':
          this.sql.exec('DELETE FROM blocks WHERE blocker=? AND blocked=?', actor, id(input.id, MEMBER_ID));
          return done;
        case 'leave': return this.leave(actor, circle);
        case 'appearance': return this.setAppearance(member, input);
        case 'removeMember':
          this.requireHost(circle, actor);
          return this.removeMember(circle, id(input.id, MEMBER_ID));
        case 'rotateInvite':
          this.requireHost(circle, actor);
          return { code: `${circleID}.${this.replaceSecret()}` };
        default: return fail(404, 'not_found');
      }
    });
  }

  private setAppearance(member: Member, input: Input) {
    const style = input.style;
    if (style !== 'clay' && style !== 'saffron' && style !== 'tide' && style !== 'dusk') {
      return fail(400, 'invalid_input');
    }
    if (member.style !== style) {
      this.takeWrite(member.id);
      this.sql.exec('UPDATE members SET style=? WHERE id=?', style, member.id);
    }
    return done;
  }

  private create(circleID: string, actor: string, input: Input, current?: CircleRow) {
    if (current) {
      const member = this.member(actor);
      if (!current.closed && current.owner === actor && member) return this.summary(circleID, member, current);
      return fail(409, 'id_conflict');
    }
    const title = text(input.title, 64);
    const name = text(input.name, 36);
    const secret = opaqueID();
    return this.ctx.storage.transactionSync(() => {
      this.sql.exec(`
        CREATE TABLE circle (title TEXT NOT NULL, owner TEXT NOT NULL, secret TEXT NOT NULL,
          closed INTEGER NOT NULL DEFAULT 0, lastEventAt INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE members (id TEXT PRIMARY KEY, name TEXT NOT NULL, joinedAt INTEGER NOT NULL,
          style TEXT CHECK(style IN ('clay', 'saffron', 'tide', 'dusk')));
        CREATE TABLE moments (id TEXT PRIMARY KEY, author TEXT NOT NULL, text TEXT NOT NULL,
          createdAt INTEGER NOT NULL, region TEXT, photo TEXT, photoDescription TEXT);
        CREATE INDEX moments_by_time ON moments (createdAt DESC);
        CREATE INDEX moments_by_author ON moments (author, createdAt DESC);
        CREATE TABLE replies (id TEXT PRIMARY KEY, momentID TEXT NOT NULL, author TEXT NOT NULL,
          text TEXT NOT NULL, createdAt INTEGER NOT NULL);
        CREATE INDEX replies_by_moment ON replies (momentID, createdAt);
        CREATE INDEX replies_by_author ON replies (author);
        CREATE TABLE reactions (momentID TEXT NOT NULL, author TEXT NOT NULL, PRIMARY KEY (momentID, author));
        CREATE TABLE reads (momentID TEXT NOT NULL, reader TEXT NOT NULL, through INTEGER NOT NULL,
          PRIMARY KEY (momentID, reader));
        CREATE TABLE blocks (blocker TEXT NOT NULL, blocked TEXT NOT NULL, PRIMARY KEY (blocker, blocked));
        CREATE TABLE reports (kind TEXT NOT NULL, target TEXT NOT NULL, reporter TEXT NOT NULL,
          resolved INTEGER NOT NULL DEFAULT 0, ${REPORT_REASON_COLUMN}, PRIMARY KEY (kind, target, reporter));
        CREATE TABLE removed (kind TEXT NOT NULL, id TEXT NOT NULL, PRIMARY KEY (kind, id));
        CREATE TABLE limits (actor TEXT PRIMARY KEY, started INTEGER NOT NULL, count INTEGER NOT NULL);
      `);
      this.sql.exec('INSERT INTO circle (title, owner, secret) VALUES (?, ?, ?)', title, actor, secret);
      this.sql.exec('INSERT INTO members (id, name, joinedAt) VALUES (?, ?, ?)', actor, name, Date.now());
      this.ctx.storage.kv.put('initialized', true);
      this.ctx.storage.kv.put('report-reasons', true);
      return this.summary(circleID, { id: actor, name }, { title, owner: actor, secret, closed: 0, lastEventAt: 0 });
    });
  }

  private join(circleID: string, actor: string, input: Input, circle: CircleRow) {
    if (typeof input.secret !== 'string' || !HEX_ID.test(input.secret) || !sameSecret(circle.secret, input.secret)) {
      return fail(403, 'invalid_invite');
    }
    const existing = this.member(actor);
    if (existing) return this.summary(circleID, existing, circle);
    const name = text(input.name, 36);
    return this.ctx.storage.transactionSync(() => {
      if (this.memberCount() >= MEMBER_LIMIT) return fail(409, 'circle_full');
      this.sql.exec('INSERT INTO members (id, name, joinedAt) VALUES (?, ?, ?)', actor, name, Date.now());
      return this.summary(circleID, { id: actor, name }, circle);
    });
  }

  private circle() {
    if (this.ctx.storage.kv.get('initialized') !== true) return undefined;
    return this.sql.exec<CircleRow>('SELECT title, owner, secret, closed, lastEventAt FROM circle').one();
  }
  private ensureReportReasons() {
    if (this.ctx.storage.kv.get('report-reasons') === true) return;
    // Build 16 circles already have a reports table. Add a default in place,
    // then commit the marker together with the schema change.
    this.ctx.storage.transactionSync(() => {
      this.sql.exec(`ALTER TABLE reports ADD COLUMN ${REPORT_REASON_COLUMN}`);
      this.ctx.storage.kv.put('report-reasons', true);
    });
  }
  private member(actor: string) {
    return this.sql.exec<Member>('SELECT id, name, style FROM members WHERE id=?', actor).toArray()[0];
  }
  private memberCount() {
    return this.sql.exec<{ count: number }>('SELECT count(*) AS count FROM members').one().count;
  }
  private summary(circleID: string, me: Member, circle: CircleRow) {
    const otherMembers = this.sql.exec<{ count: number }>(
      `SELECT count(*) AS count FROM members a WHERE ${unblocked('a.id')}`, me.id,
    ).one().count;
    return { id: circleID, title: circle.title, me, memberCount: otherMembers, canInvite: circle.owner === me.id };
  }
  private requireHost(circle: CircleRow, actor: string) {
    if (circle.owner !== actor) return fail(403, 'forbidden');
  }

  private snapshot(circleID: string, me: Member, circle: CircleRow) {
    const moments = this.sql.exec<SummaryRow>(
      `${momentSummary} ORDER BY m.createdAt DESC, m.id DESC LIMIT 64`, me.id,
    ).toArray().map(row => this.momentJSON(row, me.id));
    const unread = this.sql.exec<FullReplyRow>(
      `SELECT r.id, r.momentID, r.author, r.text, r.createdAt, a.name AS authorName, a.style AS authorStyle
       FROM moments m JOIN replies r ON r.momentID=m.id JOIN members a ON a.id=r.author
       LEFT JOIN reads seen ON seen.momentID=m.id AND seen.reader=?1
       WHERE m.author=?1 AND r.author<>?1 AND r.createdAt>coalesce(seen.through, 0)
         AND ${visible('m', 'moment')} AND ${visible('r', 'reply')}
       ORDER BY r.createdAt DESC, r.id DESC LIMIT 32`, me.id,
    ).toArray();
    const activity = unread.map(row => ({
      momentID: row.momentID, replyID: row.id, author: authorJSON(row),
      text: row.text, createdAt: row.createdAt,
    }));
    return { circle: this.summary(circleID, me, circle), moments, activity };
  }

  private detail(actor: string, target: string) {
    const moment = this.sql.exec<SummaryRow>(`${momentSummary} AND m.id=?2`, actor, target).toArray()[0];
    if (!moment) return fail(404, 'not_found');
    const photo = moment.hasPhoto
      ? this.sql.exec<{ photo: string }>('SELECT photo FROM moments WHERE id=?', target).one().photo
      : null;
    const replies = this.sql.exec<FullReplyRow>(
      `SELECT r.id, r.momentID, r.author, r.text, r.createdAt, a.name AS authorName, a.style AS authorStyle
       FROM replies r JOIN members a ON a.id=r.author
       WHERE r.momentID=?2 AND ${visible('r', 'reply')}
       ORDER BY r.createdAt ASC, r.id ASC`, actor, target,
    ).toArray().map(row => ({
      id: row.id, author: authorJSON(row), text: row.text,
      createdAt: row.createdAt, owned: row.author === actor,
    }));
    return { moment: this.momentJSON(moment, actor), photo, replies };
  }
  private momentJSON(row: SummaryRow, actor: string) {
    return {
      id: row.id, author: authorJSON(row), text: row.text, createdAt: row.createdAt,
      region: row.region, hasPhoto: Boolean(row.hasPhoto), photoDescription: row.photoDescription,
      replyCount: row.replyCount, reactionCount: row.reactionCount, reacted: Boolean(row.reacted),
      owned: row.author === actor,
    };
  }
  private requireMoment(actor: string, target: string) {
    const moment = this.sql.exec<{ id: string; author: string }>(
      `SELECT m.id, m.author FROM moments m WHERE m.id=?2 AND ${visible('m', 'moment')}`, actor, target,
    ).toArray()[0];
    return moment ?? fail(404, 'not_found');
  }

  private publish(actor: string, input: Input) {
    const momentID = id(input.id);
    const body = text(input.text, 480, true, true);
    const area = region(input.region);
    const image = circlePhoto(input.photo);
    const description = image ? text(input.photoDescription, 140) : null;
    if (!body && !image) return fail(400, 'invalid_text');

    const existing = this.sql.exec<MomentRow>('SELECT * FROM moments WHERE id=?', momentID).toArray()[0];
    if (existing) {
      if (existing.author !== actor || existing.text !== body || existing.region !== area ||
          existing.photo !== image || existing.photoDescription !== description) return fail(409, 'id_conflict');
      return { id: momentID };
    }
    this.requireUnused('moment', momentID);
    if (this.sql.exec<{ count: number }>('SELECT count(*) AS count FROM moments').one().count >= MOMENT_LIMIT) {
      return fail(409, 'limit_reached');
    }
    this.takeWrite(actor);
    const createdAt = this.nextTimestamp();
    this.sql.exec(
      'INSERT INTO moments (id, author, text, createdAt, region, photo, photoDescription) VALUES (?, ?, ?, ?, ?, ?, ?)',
      momentID, actor, body, createdAt, area, image, description,
    );
    return { id: momentID };
  }

  private reply(actor: string, momentID: string, input: Input) {
    this.requireMoment(actor, momentID);
    const replyID = id(input.id);
    const body = text(input.text, 240, false, true);
    const existing = this.sql.exec<ReplyRow>('SELECT * FROM replies WHERE id=?', replyID).toArray()[0];
    if (existing) {
      if (existing.author !== actor || existing.momentID !== momentID || existing.text !== body) {
        return fail(409, 'id_conflict');
      }
      return { id: replyID };
    }
    this.requireUnused('reply', replyID);
    if (this.sql.exec<{ count: number }>(
      'SELECT count(*) AS count FROM replies WHERE momentID=?', momentID,
    ).one().count >= REPLY_LIMIT) return fail(409, 'limit_reached');
    this.takeWrite(actor);
    const createdAt = this.nextTimestamp();
    this.sql.exec('INSERT INTO replies (id, momentID, author, text, createdAt) VALUES (?, ?, ?, ?, ?)',
      replyID, momentID, actor, body, createdAt);
    return { id: replyID };
  }

  private reaction(actor: string, momentID: string, input: Input) {
    this.requireMoment(actor, momentID);
    if (typeof input.active !== 'boolean') return fail(400, 'invalid_input');
    const exists = this.sql.exec(
      'SELECT 1 FROM reactions WHERE momentID=? AND author=?', momentID, actor,
    ).toArray().length > 0;
    if (input.active === exists) return done;
    this.takeWrite(actor);
    if (input.active) {
      this.sql.exec('INSERT INTO reactions (momentID, author) VALUES (?, ?)', momentID, actor);
    } else {
      this.sql.exec('DELETE FROM reactions WHERE momentID=? AND author=?', momentID, actor);
    }
    return done;
  }

  private markRead(actor: string, input: Input) {
    const momentID = id(input.momentID);
    const moment = this.requireMoment(actor, momentID);
    if (moment.author !== actor) return fail(403, 'forbidden');
    const cutoff = input.through;
    if (typeof cutoff !== 'number' || !Number.isSafeInteger(cutoff) || cutoff < 0) return fail(400, 'invalid_input');
    const lastSeen = this.sql.exec<{ lastSeen: number | null }>(
      `SELECT max(r.createdAt) AS lastSeen FROM replies r
       WHERE r.momentID=?2 AND r.createdAt<=?3 AND ${visible('r', 'reply')}`, actor, momentID, cutoff,
    ).one().lastSeen;
    if (lastSeen !== null) {
      this.sql.exec(
        `INSERT INTO reads (momentID, reader, through) VALUES (?, ?, ?)
         ON CONFLICT (momentID, reader) DO UPDATE SET through=max(through, excluded.through)
         WHERE excluded.through>through`, momentID, actor, lastSeen,
      );
    }
    return done;
  }

  private requireUnused(type: Kind, contributionID: string) {
    if (this.sql.exec('SELECT 1 FROM removed WHERE kind=? AND id=?', type, contributionID).toArray().length) {
      return fail(409, 'id_conflict');
    }
    const total = this.sql.exec<{ count: number }>(
      'SELECT (SELECT count(*) FROM moments)+(SELECT count(*) FROM replies)+(SELECT count(*) FROM removed) AS count',
    ).one().count;
    if (total >= HISTORY_LIMIT) return fail(409, 'limit_reached');
  }
  private nextTimestamp() {
    return this.sql.exec<{ lastEventAt: number }>(
      'UPDATE circle SET lastEventAt=max(lastEventAt+1, ?) RETURNING lastEventAt', Date.now(),
    ).one().lastEventAt;
  }
  private takeWrite(actor: string) {
    const now = Date.now();
    const current = this.sql.exec<{ started: number; count: number }>(
      'SELECT started, count FROM limits WHERE actor=?', actor,
    ).toArray()[0];
    const started = current && now - current.started < WRITE_WINDOW_MS ? current.started : now;
    const count = current && current.started === started ? current.count + 1 : 1;
    if (count > WRITE_LIMIT) return fail(429, 'write_limited');
    this.sql.exec(
      `INSERT INTO limits (actor, started, count) VALUES (?, ?, ?)
       ON CONFLICT (actor) DO UPDATE SET started=excluded.started, count=excluded.count`, actor, started, count,
    );
  }

  private moderationTarget(actor: string, type: Kind, target: string, includeReported: boolean) {
    const row = type === 'moment'
      ? this.sql.exec<ContributionRow>(
        `SELECT m.id, m.author, m.text, m.createdAt FROM moments m
         WHERE m.id=?2 AND ${includeReported ? unblocked('m.author') : visible('m', 'moment')}`, actor, target,
      ).toArray()[0]
      : this.sql.exec<ContributionRow>(
        `SELECT r.id, r.author, r.text, r.createdAt FROM replies r JOIN moments m ON m.id=r.momentID
         WHERE r.id=?2 AND ${includeReported ? unblocked('m.author') : visible('m', 'moment')}
         AND ${includeReported ? unblocked('r.author') : visible('r', 'reply')}`, actor, target,
      ).toArray()[0];
    return row ?? fail(404, 'not_found');
  }
  private moderate(actor: string, circle: CircleRow, input: Input) {
    const type = kind(input.kind);
    const target = id(input.target);
    const action = input.action;
    if (action !== 'report' && action !== 'block' && action !== 'remove') return fail(400, 'invalid_input');
    const reason = action === 'report' ? reportReason(input.reason) : null;
    if (action === 'report' && this.sql.exec(
      'SELECT 1 FROM reports WHERE kind=? AND target=? AND reporter=?', type, target, actor,
    ).toArray().length) return done;
    const hostRemoval = action === 'remove' && circle.owner === actor;
    const row = this.moderationTarget(actor, type, target, hostRemoval);
    if (action === 'remove') {
      if (row.author !== actor && !hostRemoval) return fail(403, 'forbidden');
      if (type === 'moment') this.removeMoments('id', target);
      else this.removeReplies('id', target);
      return done;
    }
    if (row.author === actor) return fail(403, 'forbidden');
    this.takeWrite(actor);
    if (action === 'report') {
      this.sql.exec('INSERT INTO reports (kind, target, reporter, reason) VALUES (?, ?, ?, ?)', type, target, actor, reason);
    } else {
      this.sql.exec('INSERT OR IGNORE INTO blocks (blocker, blocked) VALUES (?, ?)', actor, row.author);
    }
    return done;
  }

  private reportRows(actor: string, type: Kind, target?: string) {
    const table = type === 'moment' ? 'moments' : 'replies';
    const parent = type === 'reply' ? 'JOIN moments m ON m.id=p.momentID' : '';
    const parentVisible = type === 'reply' ? `AND ${unblocked('m.author')}` : '';
    const targetFilter = target ? 'AND p.id=?3' : '';
    const values = target ? [actor, type, target] : [actor, type];
    const reasons = REPORT_REASONS.map(reason => `sum(f.reason='${reason}') AS ${reason}`).join(', ');
    return this.sql.exec<ReportRow>(
      `SELECT p.id, p.author, p.text, p.createdAt, a.name AS authorName, a.style AS authorStyle,
         count(*) AS reportCount, ${reasons}
       FROM reports f JOIN ${table} p ON p.id=f.target JOIN members a ON a.id=p.author
       ${parent}
       WHERE f.kind=?2 AND f.resolved=0 AND ${unblocked('p.author')} AND ${unblocked('f.reporter')}
         ${parentVisible} ${targetFilter}
       GROUP BY p.id ORDER BY p.createdAt DESC LIMIT 64`, ...values,
    ).toArray().map(row => ({
      kind: type, target: row.id, author: authorJSON(row), text: row.text, createdAt: row.createdAt,
      reportCount: row.reportCount, reasons: {
        harassment: row.harassment, spam: row.spam, privacy: row.privacy, other: row.other,
      },
    }));
  }
  private reports(actor: string) {
    return {
      reports: [...this.reportRows(actor, 'moment'), ...this.reportRows(actor, 'reply')]
        .sort((left, right) => right.createdAt - left.createdAt).slice(0, 64),
    };
  }
  private reportDetail(actor: string, type: Kind, target: string) {
    const report = this.reportRows(actor, type, target)[0];
    if (!report) return fail(404, 'not_found');
    if (type === 'reply') return { report };
    const { photo, photoDescription } = this.sql.exec<{ photo: string | null; photoDescription: string | null }>(
      'SELECT photo, photoDescription FROM moments WHERE id=?', target,
    ).one();
    return photo ? { report, photo, photoDescription } : { report };
  }
  private resolve(actor: string, input: Input) {
    const type = kind(input.kind);
    const target = id(input.target);
    this.moderationTarget(actor, type, target, true);
    this.sql.exec('UPDATE reports SET resolved=1 WHERE kind=? AND target=? AND resolved=0', type, target);
    return done;
  }
  private blocks(actor: string) {
    const members = this.sql.exec<Member>(
      `SELECT b.blocked AS id, coalesce(a.name, '') AS name, a.style FROM blocks b
       LEFT JOIN members a ON a.id=b.blocked WHERE b.blocker=? ORDER BY a.name, b.blocked`, actor,
    ).toArray();
    return { members };
  }

  private removeReplies(column: 'id' | 'author', value: string) {
    const selected = `SELECT id FROM replies WHERE ${column}=?`;
    this.sql.exec(`INSERT INTO removed (kind, id) SELECT 'reply', id FROM replies WHERE ${column}=?`, value);
    this.sql.exec(`DELETE FROM reports WHERE kind='reply' AND target IN (${selected})`, value);
    this.sql.exec(`DELETE FROM replies WHERE ${column}=?`, value);
  }
  private removeMoments(column: 'id' | 'author', value: string) {
    const selected = `SELECT id FROM moments WHERE ${column}=?`;
    this.sql.exec(`INSERT INTO removed (kind, id) SELECT 'moment', id FROM moments WHERE ${column}=?`, value);
    this.sql.exec(
      `INSERT INTO removed (kind, id) SELECT 'reply', id FROM replies WHERE momentID IN (${selected})`, value,
    );
    this.sql.exec(
      `DELETE FROM reports WHERE kind='reply' AND target IN (
        SELECT id FROM replies WHERE momentID IN (${selected})
       )`, value,
    );
    this.sql.exec(`DELETE FROM reports WHERE kind='moment' AND target IN (${selected})`, value);
    this.sql.exec(`DELETE FROM reads WHERE momentID IN (${selected})`, value);
    this.sql.exec(`DELETE FROM reactions WHERE momentID IN (${selected})`, value);
    this.sql.exec(`DELETE FROM replies WHERE momentID IN (${selected})`, value);
    this.sql.exec(`DELETE FROM moments WHERE ${column}=?`, value);
  }
  private deleteMemberRecords(memberID: string) {
    this.removeMoments('author', memberID);
    this.removeReplies('author', memberID);
    this.sql.exec('DELETE FROM reactions WHERE author=?', memberID);
    this.sql.exec('DELETE FROM reads WHERE reader=?', memberID);
    this.sql.exec('DELETE FROM reports WHERE reporter=?', memberID);
    this.sql.exec('DELETE FROM blocks WHERE blocker=?', memberID);
    this.sql.exec('DELETE FROM limits WHERE actor=?', memberID);
    this.sql.exec('DELETE FROM members WHERE id=?', memberID);
  }
  private removeMember(circle: CircleRow, memberID: string) {
    if (memberID === circle.owner) return fail(403, 'forbidden');
    if (this.member(memberID)) {
      this.deleteMemberRecords(memberID);
      this.replaceSecret();
    }
    return done;
  }
  private replaceSecret() {
    const secret = opaqueID();
    this.sql.exec('UPDATE circle SET secret=?', secret);
    return secret;
  }
  private leave(actor: string, circle: CircleRow) {
    this.deleteMemberRecords(actor);
    if (circle.owner === actor) {
      const next = this.sql.exec<{ id: string }>('SELECT id FROM members ORDER BY joinedAt, id LIMIT 1').toArray()[0];
      if (next) {
        // A previous owner cannot keep using the old invitation after ownership changes.
        this.sql.exec('UPDATE circle SET owner=?, secret=?', next.id, opaqueID());
      } else {
        this.sql.exec("UPDATE circle SET owner='', secret='', title='', closed=1, lastEventAt=0");
        this.sql.exec('DELETE FROM removed');
      }
    }
    return done;
  }
}
