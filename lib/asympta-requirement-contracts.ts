import { expandAutomaticClarificationFields } from "./asympta-automatic-clarification-options.ts";
import { canonicalizeRequirementSemantic } from "./asympta-semantic-kernel.ts";
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
const PROPERTY_PATTERN = /(?:\breal[ -]?estate\b|\bproperty\b|\bproperties\b|\bhouse\b|\bhome\b|\bapartment\b|\bflat\b|\bcondo(?:minium)?\b|\btownhouse\b|\bland\b|房屋|房子|住宅|樓盤|楼盘|公寓|單位|单位|物業|物业|地產|地产|不動産|住宅|マンション|アパート|一戸建て|土地)/iu;
const PURCHASE_PATTERN = /(?:\b(?:buy|purchase|order|shop\s+for|acquire)\b|購買|购买|買|买|訂購|订购|購入|注文)/iu;
const ABSTRACT_FIELD_PATTERN = /(?:other|remaining|necessary|required|details?|information|specifications?|specs?|其他|其餘|其余|必要|資料|资料|資訊|信息|規格|规格|その他|残り|必要な|情報|仕様)/iu;
const CONCRETE_FIELD_PATTERN = /(?:budget|price|quantity|count|purpose|use|brand|model|type|size|range|capacity|location|area|district|neighbou?rhood|bedroom|room|financ|mortgage|cash|property|house|apartment|flat|condo|vendor|supplier|store|shop|delivery|shipping|pickup|deadline|timeframe|date|movie|film|cinema|showtime|session|approval|compliance|licen[cs]e|registration|預算|预算|數量|数量|用途|品牌|型號|型号|類型|类型|尺寸|航程|容量|地點|地点|地區|地区|區域|区域|房型|睡房|房間|房间|按揭|貸款|贷款|現金|现金|房屋|房子|住宅|樓盤|楼盘|公寓|物業|物业|供應商|供应商|商店|配送|送貨|送货|自取|期限|日期|電影|电影|影片|片名|戲院|戏院|影院|場次|场次|批准|合規|合规|牌照|執照|执照|登記|登记|予算|数量|用途|ブランド|モデル|種類|サイズ|場所|地域|エリア|寝室|部屋|住宅|不動産|マンション|アパート|住宅ローン|現金|業者|店舗|配送|受取|期限|映画|映画館|上映|承認|規制|免許|登録)/iu;

const REQUIREMENT_CONTRACTS: RequirementContractDefinition[] = [
  {
    id: "real-estate.residential-purchase.v1",
    priority: 120,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => PROPERTY_PATTERN.test(context.rootIntent)
      && (context.actionFamily === "purchase" || PURCHASE_PATTERN.test(context.rootIntent)),
    requirements: [
      { semantic: "property_location", field: "property location" },
      { semantic: "budget", field: "budget" },
      { semantic: "property_type", field: "property type" },
      { semantic: "bedrooms", field: "bedrooms" },
      { semantic: "financing", field: "financing preference" },
    ],
  },
  {
    id: "travel.flight.booking.v1",
    priority: 119,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => context.domain === "travel.flight" || (context.domain === "travel" && /book|booking/iu.test(context.actionFamily)),
    requirements: [
      { semantic: "origin", field: "origin" },
      { semantic: "destination", field: "destination" },
      { semantic: "departure_date", field: "departure date" },
      { semantic: "identity", field: "identity" },
      { semantic: "budget", field: "budget" },
    ],
  },
  {
    id: "hospitality.hotel.booking.v1",
    priority: 118,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => context.domain === "hospitality.hotel",
    requirements: [
      { semantic: "destination", field: "destination" },
      { semantic: "check_in_date", field: "check-in date" },
      { semantic: "check_out_date", field: "check-out date" },
      { semantic: "participants", field: "participants" },
      { semantic: "budget", field: "budget" },
    ],
  },
  {
    id: "hospitality.restaurant.reservation.v1",
    priority: 117,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => context.domain === "hospitality.restaurant" || (context.domain === "hospitality" && /reserve|reservation/iu.test(context.actionFamily)),
    requirements: [
      { semantic: "cuisine", field: "cuisine" },
      { semantic: "participants", field: "participants" },
      { semantic: "date", field: "date" },
      { semantic: "time", field: "time" },
      { semantic: "location", field: "location" },
    ],
  },
  {
    id: "healthcare.appointment.v1",
    priority: 116,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => context.domain === "healthcare",
    requirements: [
      { semantic: "service", field: "service" },
      { semantic: "symptom", field: "symptom" },
      { semantic: "urgency", field: "urgency" },
      { semantic: "identity", field: "identity" },
    ],
  },
  {
    id: "employment.application.v1",
    priority: 115,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => context.domain === "employment" || context.actionFamily === "apply",
    requirements: [
      { semantic: "role_preference", field: "role preference" },
      { semantic: "document", field: "document" },
      { semantic: "identity", field: "identity" },
      { semantic: "contact", field: "contact" },
      { semantic: "approval", field: "approval" },
    ],
  },
  {
    id: "government.submission.v1",
    priority: 114,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => context.domain === "government",
    requirements: [
      { semantic: "service", field: "service" },
      { semantic: "identity", field: "identity" },
      { semantic: "document", field: "document" },
      { semantic: "deadline", field: "deadline" },
      { semantic: "approval", field: "approval" },
    ],
  },
  {
    id: "finance.transfer.v1",
    priority: 113,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => context.domain === "finance" || context.actionFamily === "transfer",
    requirements: [
      { semantic: "recipient", field: "recipient" },
      { semantic: "amount", field: "amount" },
      { semantic: "currency", field: "currency" },
      { semantic: "account", field: "account" },
      { semantic: "approval", field: "approval" },
    ],
  },
  {
    id: "logistics.shipment.v1",
    priority: 112,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => context.domain === "logistics" || context.actionFamily === "ship",
    requirements: [
      { semantic: "origin", field: "origin" },
      { semantic: "delivery_location", field: "delivery location" },
      { semantic: "recipient", field: "recipient" },
      { semantic: "package_size", field: "package size" },
      { semantic: "payment", field: "payment" },
    ],
  },
  {
    id: "home-services.repair.v1",
    priority: 111,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => ["home_services", "home-services"].includes(context.domain) && context.actionFamily === "repair",
    requirements: [
      { semantic: "service", field: "service" },
      { semantic: "issue_specification", field: "issue specification" },
      { semantic: "delivery_location", field: "delivery location" },
      { semantic: "date", field: "date" },
      { semantic: "budget", field: "budget" },
    ],
  },
  {
    id: "calendar.meeting.v1",
    priority: 110,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => context.domain === "calendar",
    requirements: [
      { semantic: "participants", field: "participants" },
      { semantic: "date", field: "date" },
      { semantic: "time", field: "time" },
      { semantic: "duration", field: "duration" },
      { semantic: "purpose", field: "purpose" },
    ],
  },
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

export function requirementSemantic(value: string) {
  return canonicalizeRequirementSemantic(value);
}

function isAbstractField(field: string) {
  const compact = field.replace(/\s+/g, " ").trim();
  if (!compact) return true;
  return ABSTRACT_FIELD_PATTERN.test(compact) && !CONCRETE_FIELD_PATTERN.test(compact);
}

function inferContext(input: Pick<CreateAsymptaTaskInput, "rootIntent" | "domain" | "actionFamily">): ContractContext {
  const rootIntent = input.rootIntent.trim();
  const propertyPurchase = PROPERTY_PATTERN.test(rootIntent) && PURCHASE_PATTERN.test(rootIntent);
  const actionFamily = input.actionFamily
    ?? (propertyPurchase
      ? "purchase"
      : PURCHASE_PATTERN.test(rootIntent)
        ? "purchase"
        : CINEMA_PATTERN.test(rootIntent)
          ? "discover"
          : EVENT_PATTERN.test(rootIntent)
            ? "attend"
            : "coordinate");
  const domain = input.domain
    ?? (propertyPurchase
      ? "real_estate.residential"
      : TV_PATTERN.test(rootIntent)
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
