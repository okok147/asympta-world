import { expandAutomaticClarificationFields } from "./asympta-automatic-clarification-options.ts";
import type {
  AsymptaTaskRequirement,
  AsymptaTaskRequirementStatus,
  AsymptaTaskState,
  CreateAsymptaTaskInput,
} from "./asympta-task-kernel-types.ts";

export type AsymptaRequirementContractCompletionMode =
  | "simulated_execution"
  | "simulated_proposal"
  | "live_action";

export type AsymptaRequirementContractProposalKind =
  | "procurement"
  | "coordination"
  | "event_discovery";

export type AsymptaRequirementContractSnapshot = {
  id: string;
  version: "asympta.requirement-contract/0.1";
  source: "registry";
  completionMode: AsymptaRequirementContractCompletionMode;
  proposalKind: AsymptaRequirementContractProposalKind;
  requiredSemantics: string[];
  synthesizedFields: string[];
};

type ContractContext = {
  rootIntent: string;
  domain: string;
  actionFamily: string;
};

type RequirementDefinition = {
  semantic: string;
  field: string;
};

type RequirementContractDefinition = {
  id: string;
  priority: number;
  augmentation: "always" | "when_empty_or_abstract";
  completionMode: AsymptaRequirementContractCompletionMode;
  proposalKind: AsymptaRequirementContractProposalKind;
  match: (context: ContractContext) => boolean;
  requirements: RequirementDefinition[];
};

export type CompiledRequirementContract = {
  snapshot: AsymptaRequirementContractSnapshot;
  missingFields: string[];
};

const TV_PATTERN = /(?:\btv\b|\btelevision\b|smart\s*tv|電視機?|电视机?|テレビ)/iu;
const EVENT_PATTERN = /(?:concert|show|performance|ticket|演唱會|演唱会|音樂會|音乐会|門票|门票|公演|チケット)/iu;
const CINEMA_PATTERN = /(?:\bmovies?\b|\bfilms?\b|\bcinema\b|movie\s*tickets?|電影|电影|戲院|戏院|影院|映画|映画館)/iu;
const PURCHASE_PATTERN = /(?:\b(?:buy|purchase|order|shop\s+for|acquire)\b|購買|购买|買|买|訂購|订购|購入|注文)/iu;
const ABSTRACT_FIELD_PATTERN = /(?:other|remaining|necessary|required|details?|information|specifications?|specs?|其他|其餘|其余|必要|資料|资料|資訊|信息|規格|规格|その他|残り|必要な|情報|仕様)/iu;
const CONCRETE_FIELD_PATTERN = /(?:budget|price|quantity|count|purpose|use|brand|model|type|size|range|capacity|location|vendor|supplier|store|shop|delivery|shipping|pickup|deadline|timeframe|date|movie|film|cinema|showtime|session|approval|compliance|licen[cs]e|registration|預算|预算|數量|数量|用途|品牌|型號|型号|類型|类型|尺寸|航程|容量|地點|地点|供應商|供应商|商店|配送|送貨|送货|自取|期限|日期|電影|电影|影片|片名|戲院|戏院|影院|場次|场次|批准|合規|合规|牌照|執照|执照|登記|登记|予算|数量|用途|ブランド|モデル|種類|サイズ|航続|容量|場所|業者|店舗|配送|受取|期限|映画|映画館|上映|承認|規制|免許|登録)/iu;

const REQUIREMENT_CONTRACTS: RequirementContractDefinition[] = [
  {
    id: "commerce.consumer-electronics.purchase.v1",
    priority: 100,
    augmentation: "when_empty_or_abstract",
    completionMode: "simulated_execution",
    proposalKind: "procurement",
    match: (context) => context.domain === "commerce.consumer_electronics" || TV_PATTERN.test(context.rootIntent),
    requirements: [
      { semantic: "budget", field: "budget" },
      { semantic: "screen_size", field: "screen size" },
      { semantic: "brand", field: "brand preference" },
      { semantic: "delivery_location", field: "delivery location" },
    ],
  },
  {
    id: "events.cinema-discovery.v1",
    priority: 95,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "event_discovery",
    match: (context) => context.domain === "events.cinema" || CINEMA_PATTERN.test(context.rootIntent),
    requirements: [
      { semantic: "movie_preference", field: "movie preference" },
      { semantic: "cinema_area", field: "cinema area" },
      { semantic: "showtime", field: "showtime preference" },
      { semantic: "quantity", field: "ticket quantity" },
    ],
  },
  {
    id: "events.ticket-discovery.v1",
    priority: 90,
    augmentation: "when_empty_or_abstract",
    completionMode: "simulated_execution",
    proposalKind: "event_discovery",
    match: (context) => context.domain === "events" || EVENT_PATTERN.test(context.rootIntent),
    requirements: [
      { semantic: "event_intent", field: "event intent" },
      { semantic: "quantity", field: "quantity" },
      { semantic: "budget", field: "budget" },
    ],
  },
  {
    id: "commerce.purchase.generic.v1",
    priority: 70,
    augmentation: "always",
    completionMode: "simulated_proposal",
    proposalKind: "procurement",
    match: (context) => context.actionFamily === "purchase" || PURCHASE_PATTERN.test(context.rootIntent),
    requirements: [
      { semantic: "purpose", field: "purpose" },
      { semantic: "budget", field: "budget" },
      { semantic: "quantity", field: "quantity" },
      { semantic: "acquisition_channel", field: "purchase location" },
      { semantic: "fulfilment", field: "fulfilment" },
      { semantic: "deadline", field: "deadline" },
    ],
  },
  {
    id: "task.clarification.generic.v1",
    priority: 0,
    augmentation: "when_empty_or_abstract",
    completionMode: "simulated_proposal",
    proposalKind: "coordination",
    match: () => true,
    requirements: [
      { semantic: "purpose", field: "purpose" },
      { semantic: "deadline", field: "deadline" },
    ],
  },
];

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s./-]+/g, "_")
    .replace(/[^\p{L}\p{N}_]+/gu, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function requirementSemantic(value: string) {
  const normalized = normalize(value);
  if (/(?:^|_)(?:movie|film)(?:_?(?:preference|title|name))?(?:_|$)|(?:電影|电影|影片|片名|観たい映画|映画名)/u.test(normalized)) return "movie_preference";
  if (/(?:cinema_?(?:area|location)?|theat(?:er|re)_?(?:area|location)?|戲院地區|戏院地区|影院地區|影院地区|映画館_?(?:の)?エリア)/u.test(normalized)) return "cinema_area";
  if (/(?:showtime|screening_?(?:time|session)?|session_?time|上映時間|上映时间|場次時間|场次时间|場次|场次|上映時刻)/u.test(normalized)) return "showtime";
  if (/(?:delivery_?location|delivery_?address|shipping_?address|ship_?to|配送地點|配送地点|配送地址|送貨地點|送货地点|送貨地址|送货地址|收貨地址|收货地址|配送先|配達先)/u.test(normalized)) return "delivery_location";
  if (/(?:event_?(?:intent|name)|show|concert|artist|singer|band|演出|演唱會|演唱会|歌手|樂隊|乐队|公演|アーティスト|バンド)/u.test(normalized)) return "event_intent";
  if (/(?:screen_?size|display_?size|inch|螢幕尺寸|屏幕尺寸|画面サイズ|インチ)/u.test(normalized)) return "screen_size";
  if (/(?:budget|price_?range|max_?price|spend|預算|预算|予算|価格)/u.test(normalized)) return "budget";
  if (/(?:brand|maker|manufacturer|品牌|牌子|メーカー|ブランド)/u.test(normalized)) return "brand";
  if (/(?:quantity|count|amount|number|數量|数量|張數|张数|個數|个数|枚数)/u.test(normalized)) return "quantity";
  if (/(?:purchase_?location|buy_?where|store_?preference|supplier|vendor|shop|store|acquisition_?channel|購買地點|购买地点|購買方式|供應商|供应商|商店|購入先|業者|店舗)/u.test(normalized)) return "acquisition_channel";
  if (/(?:fulfil|fulfill|delivery|pickup|shipping|receive|handover|配送|送貨|送货|取貨|取货|交付|受取|引渡)/u.test(normalized)) return "fulfilment";
  if (/(?:deadline|timeframe|when|due|needed_?by|期限|需要時間|需要时间|幾時|什么时候|いつ|納期)/u.test(normalized)) return "deadline";
  if (/(?:purpose|use_?case|usage|intended_?use|用途|目的|使用目的)/u.test(normalized)) return "purpose";
  if (/(?:model|type|specification|specs|requirements|capacity|range|型號|型号|類型|类型|規格|规格|容量|航程|モデル|種類|仕様|容量|航続)/u.test(normalized)) return "item_specification";
  if (/(?:compliance|regulatory|licen[cs]e|registration|permit|approval|合規|合规|監管|监管|牌照|執照|执照|登記|登记|許可|许可|規制|免許|登録|承認)/u.test(normalized)) return "compliance";
  return normalized || "generic";
}

function isAbstractField(field: string) {
  const compact = field.replace(/\s+/g, " ").trim();
  if (!compact) return true;
  return ABSTRACT_FIELD_PATTERN.test(compact) && !CONCRETE_FIELD_PATTERN.test(compact);
}

function inferContext(input: Pick<CreateAsymptaTaskInput, "rootIntent" | "domain" | "actionFamily">): ContractContext {
  const rootIntent = input.rootIntent.trim();
  const actionFamily = input.actionFamily
    ?? (PURCHASE_PATTERN.test(rootIntent)
      ? "purchase"
      : CINEMA_PATTERN.test(rootIntent)
        ? "discover"
        : EVENT_PATTERN.test(rootIntent)
          ? "attend"
          : "coordinate");
  const domain = input.domain
    ?? (TV_PATTERN.test(rootIntent)
      ? "commerce.consumer_electronics"
      : CINEMA_PATTERN.test(rootIntent)
        ? "events.cinema"
        : EVENT_PATTERN.test(rootIntent)
          ? "events"
          : actionFamily === "purchase"
            ? "commerce"
            : "general");
  return { rootIntent, domain, actionFamily };
}

function selectRequirementContract(context: ContractContext) {
  return [...REQUIREMENT_CONTRACTS]
    .sort((left, right) => right.priority - left.priority)
    .find((contract) => contract.match(context))
    ?? REQUIREMENT_CONTRACTS[REQUIREMENT_CONTRACTS.length - 1];
}

function uniqueFields(fields: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const field of fields) {
    const clean = field.replace(/\s+/g, " ").trim();
    if (!clean) continue;
    const semantic = requirementSemantic(clean);
    if (seen.has(semantic)) continue;
    seen.add(semantic);
    result.push(clean);
  }
  return result;
}

export function compileRequirementContract(input: Pick<
  CreateAsymptaTaskInput,
  "rootIntent" | "domain" | "actionFamily" | "missingFields"
>): CompiledRequirementContract {
  const context = inferContext(input);
  const contract = selectRequirementContract(context);
  const expanded = uniqueFields(expandAutomaticClarificationFields(input.missingFields));
  const concrete = expanded.filter((field) => !isAbstractField(field));
  const shouldAugment = contract.augmentation === "always" || concrete.length === 0;
  const merged = [...concrete];
  const semantics = new Set(merged.map(requirementSemantic));
  const synthesizedFields: string[] = [];
  const requiredSemantics = shouldAugment
    ? contract.requirements.map((requirement) => requirement.semantic)
    : [...semantics];

  if (shouldAugment) {
    for (const requirement of contract.requirements) {
      if (semantics.has(requirement.semantic)) continue;
      semantics.add(requirement.semantic);
      merged.push(requirement.field);
      synthesizedFields.push(requirement.field);
    }
  }

  if (!merged.length) {
    merged.push("purpose");
    synthesizedFields.push("purpose");
    requiredSemantics.push("purpose");
  }

  return {
    snapshot: {
      id: contract.id,
      version: "asympta.requirement-contract/0.1",
      source: "registry",
      completionMode: contract.completionMode,
      proposalKind: contract.proposalKind,
      requiredSemantics: [...new Set(requiredSemantics)],
      synthesizedFields,
    },
    missingFields: uniqueFields(merged),
  };
}

function requirementResolved(status: AsymptaTaskRequirementStatus) {
  return status === "resolved" || status === "confirmed" || status === "not_applicable";
}

export function resolvedRequirementSemantics(requirements: AsymptaTaskRequirement[]) {
  const resolved = new Set<string>();
  for (const requirement of requirements) {
    if (!requirementResolved(requirement.status)) continue;
    resolved.add(requirementSemantic(requirement.key));
    resolved.add(requirementSemantic(requirement.semantic));
    resolved.add(requirementSemantic(requirement.raw));
  }
  return resolved;
}

export function missingContractSemantics(task: AsymptaTaskState, snapshot: AsymptaRequirementContractSnapshot) {
  const resolved = resolvedRequirementSemantics(task.requirements);
  return snapshot.requiredSemantics.filter((semantic) => !resolved.has(semantic));
}

export function requirementFacts(task: AsymptaTaskState) {
  return Object.fromEntries(task.requirements
    .filter((requirement) => requirementResolved(requirement.status) && requirement.value !== undefined)
    .map((requirement) => [requirement.key, requirement.value]));
}
