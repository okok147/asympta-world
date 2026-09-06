"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Briefcase,
  Building2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Package,
  Send,
  Upload,
  Users,
} from "lucide-react";
import {
  buildAsymptaBusinessAgentReply,
  EMPTY_ASYMPTA_BUSINESS_PROFILE,
  parseAsymptaBusinessProducts,
  parseAsymptaBusinessProfile,
  type AsymptaBusinessProduct,
  type AsymptaBusinessProfile,
} from "@/lib/asympta-business-workspace";
import styles from "./asympta-business-mode.module.css";
import { AsymptaSimulationWorkspace } from "./asympta-simulation-workspace";

type AudienceMode = "users" | "business";
type BusinessWorkspaceTab = "agent" | "profile" | "catalog";

type BusinessThreadMessage = {
  id: string;
  role: "customer_agent" | "business_agent";
  text: string;
  status?: "answered" | "needs_business_confirmation";
};

const MODE_KEY = "asympta:audience-mode:v1";
const PROFILE_KEY = "asympta:business-profile:v1";
const PRODUCTS_KEY = "asympta:business-products:v1";
const THREAD_KEY = "asympta:business-thread:v1";
const BUSINESS_ACCENT = "#c56f4a";
const BUSINESS_ACCENT_SOFT = "rgba(197, 111, 74, 0.12)";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function eventId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emit(name: string, detail: unknown) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

async function readFile(file: File) {
  return file.text();
}

export function AsymptaBusinessMode() {
  const [mode, setMode] = useState<AudienceMode>("users");
  const [workspaceTab, setWorkspaceTab] = useState<BusinessWorkspaceTab>("agent");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [profile, setProfile] = useState<AsymptaBusinessProfile>(() =>
    typeof window === "undefined"
      ? { ...EMPTY_ASYMPTA_BUSINESS_PROFILE }
      : readJson(PROFILE_KEY, { ...EMPTY_ASYMPTA_BUSINESS_PROFILE }),
  );
  const [products, setProducts] = useState<AsymptaBusinessProduct[]>(() =>
    typeof window === "undefined" ? [] : readJson(PRODUCTS_KEY, [] as AsymptaBusinessProduct[]),
  );
  const [thread, setThread] = useState<BusinessThreadMessage[]>(() =>
    typeof window === "undefined" ? [] : readJson(THREAD_KEY, [] as BusinessThreadMessage[]),
  );
  const [inquiry, setInquiry] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const businessFileRef = useRef<HTMLInputElement>(null);
  const productFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.dataset.asymptaAudience = mode;
    window.localStorage.setItem(MODE_KEY, mode);
    emit("asympta:audience-mode", { mode });
    return () => {
      delete document.documentElement.dataset.asymptaAudience;
    };
  }, [mode]);

  const availableCount = useMemo(
    () => products.filter((product) => product.availability === "available").length,
    [products],
  );

  const updateProfile = (key: keyof AsymptaBusinessProfile, value: string) => {
    setProfile((current) => {
      const next = { ...current, [key]: value };
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      emit("asympta:business-profile-updated", { profile: next });
      return next;
    });
  };

  const importBusiness = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const next = parseAsymptaBusinessProfile(await readFile(file));
      setProfile(next);
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      emit("asympta:business-profile-updated", { profile: next, source: "file_import", filename: file.name });
      setImportError(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Business information could not be imported.");
    } finally {
      event.target.value = "";
    }
  };

  const importProducts = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const next = parseAsymptaBusinessProducts(await readFile(file));
      setProducts(next);
      window.localStorage.setItem(PRODUCTS_KEY, JSON.stringify(next));
      emit("asympta:business-catalog-updated", { products: next, source: "file_import", filename: file.name });
      setImportError(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Product information could not be imported.");
    } finally {
      event.target.value = "";
    }
  };

  const runBusinessAgent = () => {
    const customerText = inquiry.trim();
    if (!customerText) return;
    const customerMessage: BusinessThreadMessage = {
      id: eventId("customer"),
      role: "customer_agent",
      text: customerText,
    };
    const reply = buildAsymptaBusinessAgentReply(profile, products, customerText);
    const businessMessage: BusinessThreadMessage = {
      id: eventId("business"),
      role: "business_agent",
      text: reply.text,
      status: reply.status,
    };
    const next = [...thread, customerMessage, businessMessage].slice(-40);
    setThread(next);
    setInquiry("");
    window.localStorage.setItem(THREAD_KEY, JSON.stringify(next));
    emit("asympta:business-agent-message", {
      customer: customerMessage,
      business: businessMessage,
      evidence: reply.evidence,
      matchedProductId: reply.matchedProductId,
    });
  };

  const tabButton = (tab: BusinessWorkspaceTab, label: string, icon: ReactNode) => (
    <button
      type="button"
      role="tab"
      className={styles.importButton}
      aria-selected={workspaceTab === tab}
      onClick={() => setWorkspaceTab(tab)}
      style={workspaceTab === tab ? {
        minHeight: 32,
        padding: "0 9px",
        borderColor: BUSINESS_ACCENT,
        background: BUSINESS_ACCENT,
        color: "#fff8f2",
        fontSize: 11,
      } : {
        minHeight: 32,
        padding: "0 9px",
        borderColor: "rgba(197, 111, 74, 0.18)",
        color: "#6c4335",
        background: "rgba(255,255,255,0.58)",
        fontSize: 11,
      }}
    >
      {icon}
      {label}
    </button>
  );

  const panelCardStyle = {
    padding: "12px",
    borderRadius: "14px",
    borderColor: "rgba(197, 111, 74, 0.14)",
    boxShadow: "none",
    background: "rgba(247, 243, 233, 0.78)",
  } as const;

  return (
    <>
      <AsymptaSimulationWorkspace side={mode} />
      <nav data-asympta-mode-switch="true" className={styles.modeSwitch} aria-label="Asympta World mode">
        <button
          type="button"
          className={mode === "users" ? styles.modeActive : ""}
          aria-pressed={mode === "users"}
          onClick={() => {
            setWorkspaceOpen(false);
            setMode("users");
          }}
        >
          <Users aria-hidden="true" />
          <span>Users</span>
        </button>
        <button
          type="button"
          className={mode === "business" ? styles.modeActive : ""}
          aria-pressed={mode === "business"}
          onClick={() => setMode("business")}
          style={mode === "business" ? { background: BUSINESS_ACCENT, color: "#fff8f2" } : undefined}
        >
          <Briefcase aria-hidden="true" />
          <span>Business</span>
        </button>
      </nav>

      {mode === "business" ? (
        <aside
          className="atlas-agent-card"
          data-asympta-business-world="true"
          data-asympta-business-lens="living-world"
          data-business-workspace-open={workspaceOpen ? "true" : "false"}
          aria-label="Business agent workspace"
          style={{
            position: "fixed",
            zIndex: 1150,
            top: "auto",
            right: "max(14px, env(safe-area-inset-right))",
            bottom: "max(18px, env(safe-area-inset-bottom))",
            left: "auto",
            width: workspaceOpen ? "min(356px, calc(100vw - 24px))" : "min(206px, calc(100vw - 24px))",
            maxHeight: workspaceOpen ? "min(58dvh, 520px)" : "56px",
            overflow: "hidden",
            borderRadius: "18px",
            borderColor: "rgba(197, 111, 74, 0.24)",
            background: "rgba(250, 247, 239, 0.96)",
            boxShadow: workspaceOpen
              ? "0 16px 46px rgba(63, 45, 36, 0.15)"
              : "0 8px 24px rgba(63, 45, 36, 0.11)",
            backdropFilter: "blur(18px)",
            transition: "width 180ms ease, max-height 180ms ease, box-shadow 180ms ease",
          }}
        >
          <div
            className="atlas-agent-card__top"
            style={{
              minHeight: 54,
              gap: 9,
              padding: "8px 9px",
              borderBottom: workspaceOpen ? "1px solid rgba(197, 111, 74, 0.12)" : "0",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "grid",
                placeItems: "center",
                width: 34,
                height: 34,
                flex: "0 0 auto",
                borderRadius: 11,
                color: "#fff8f2",
                background: BUSINESS_ACCENT,
                boxShadow: `0 5px 16px ${BUSINESS_ACCENT_SOFT}`,
              }}
            >
              <Building2 size={17} strokeWidth={1.8} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>
                {profile.name || "Business agent"}
              </strong>
              <small
                style={{
                  display: workspaceOpen ? "block" : "none",
                  marginTop: 2,
                  overflow: "hidden",
                  color: "#786a64",
                  fontSize: 9.5,
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                Same living world · {availableCount} available
              </small>
            </div>
            <button
              type="button"
              className="atlas-card-close"
              aria-label={workspaceOpen ? "Collapse business workspace" : "Open business workspace"}
              aria-expanded={workspaceOpen}
              onClick={() => setWorkspaceOpen((current) => !current)}
              style={{ width: 30, height: 30, minWidth: 30, color: "#7a4a39" }}
            >
              {workspaceOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </button>
          </div>

          <div hidden={!workspaceOpen}>
            <div
              role="tablist"
              aria-label="Business workspace sections"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 6,
                padding: "8px 8px 0",
              }}
            >
              {tabButton("agent", "Agent", <MessageSquare size={13} aria-hidden="true" />)}
              {tabButton("profile", "Business", <Building2 size={13} aria-hidden="true" />)}
              {tabButton("catalog", "Products", <Package size={13} aria-hidden="true" />)}
            </div>

            <div
              style={{
                maxHeight: "min(44dvh, 390px)",
                padding: 8,
                overflow: "auto",
                overscrollBehavior: "contain",
              }}
            >
              {importError ? <div className={styles.error} role="alert">{importError}</div> : null}

              <section
                hidden={workspaceTab !== "agent"}
                className={`${styles.card} ${styles.communicationCard}`}
                aria-labelledby="communication-title"
                style={panelCardStyle}
              >
                <div className={styles.cardHeading} style={{ marginBottom: 10 }}>
                  <div>
                    <p style={{ color: "#a55539" }}>LIVE</p>
                    <h2 id="communication-title" style={{ fontSize: 15 }}>Business Agent ↔ Customer Agent</h2>
                  </div>
                  <span className={styles.localBadge} style={{ color: "#8a513d", background: BUSINESS_ACCENT_SOFT, fontSize: 9 }}>
                    <MessageSquare aria-hidden="true" /> Local
                  </span>
                </div>

                <div className={styles.thread} aria-live="polite" style={{ minHeight: 128, maxHeight: 210, padding: 10 }}>
                  {thread.length ? thread.map((message) => (
                    <article
                      key={message.id}
                      className={message.role === "business_agent" ? styles.businessMessage : styles.customerMessage}
                      style={message.role === "business_agent" ? { background: BUSINESS_ACCENT, color: "#fff9f3" } : undefined}
                    >
                      <span>{message.role === "business_agent" ? "Business agent" : "Customer agent"}</span>
                      <p>{message.text}</p>
                      {message.status === "needs_business_confirmation" ? <small>Needs business confirmation</small> : null}
                    </article>
                  )) : (
                    <div className={styles.threadEmpty} style={{ padding: 16 }}>
                      Customer agents can ask about imported business information and products.
                    </div>
                  )}
                </div>

                <div className={styles.composer} style={{ gridTemplateColumns: "1fr", gap: 7, marginTop: 8 }}>
                  <textarea
                    value={inquiry}
                    onChange={(event) => setInquiry(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        runBusinessAgent();
                      }
                    }}
                    placeholder="Customer agent: Do you have the sourdough loaf in stock?"
                    style={{ minHeight: 44, maxHeight: 88 }}
                  />
                  <button
                    type="button"
                    onClick={runBusinessAgent}
                    disabled={!inquiry.trim()}
                    style={{ minWidth: 0, minHeight: 36, borderColor: BUSINESS_ACCENT, background: BUSINESS_ACCENT, color: "#fff8f2" }}
                  >
                    <Send aria-hidden="true" /> Run communication
                  </button>
                </div>
              </section>

              <section
                hidden={workspaceTab !== "profile"}
                className={styles.card}
                aria-labelledby="business-info-title"
                style={panelCardStyle}
              >
                <div className={styles.cardHeading} style={{ marginBottom: 10 }}>
                  <div>
                    <p style={{ color: "#a55539" }}>BUSINESS</p>
                    <h2 id="business-info-title" style={{ fontSize: 15 }}>Business information</h2>
                  </div>
                  <button
                    type="button"
                    className={styles.importButton}
                    onClick={() => businessFileRef.current?.click()}
                    style={{ minHeight: 32, padding: "0 9px", color: "#7a4a39", borderColor: "rgba(197, 111, 74, 0.2)", fontSize: 10 }}
                  >
                    <Upload aria-hidden="true" /> Import JSON / CSV
                  </button>
                  <input ref={businessFileRef} className={styles.hiddenInput} type="file" accept=".json,.csv,text/csv,application/json" onChange={importBusiness} />
                </div>

                <div className={styles.formGrid}>
                  <label>
                    <span>Business name</span>
                    <input value={profile.name} onChange={(event) => updateProfile("name", event.target.value)} placeholder="Example: Harbour Bakery" />
                  </label>
                  <label>
                    <span>Category</span>
                    <input value={profile.category} onChange={(event) => updateProfile("category", event.target.value)} placeholder="Bakery, retail, services…" />
                  </label>
                  <label className={styles.wideField}>
                    <span>Description</span>
                    <textarea value={profile.description} onChange={(event) => updateProfile("description", event.target.value)} placeholder="What the business does and what customers should know." />
                  </label>
                  <label>
                    <span>Location</span>
                    <input value={profile.location} onChange={(event) => updateProfile("location", event.target.value)} placeholder="Shop / service location" />
                  </label>
                  <label>
                    <span>Contact</span>
                    <input value={profile.contact} onChange={(event) => updateProfile("contact", event.target.value)} placeholder="Phone or public contact" />
                  </label>
                  <label className={styles.wideField}>
                    <span>Opening hours</span>
                    <input value={profile.hours} onChange={(event) => updateProfile("hours", event.target.value)} placeholder="Mon–Fri 09:00–18:00" />
                  </label>
                </div>
              </section>

              <section
                hidden={workspaceTab !== "catalog"}
                className={styles.card}
                aria-labelledby="catalog-title"
                style={panelCardStyle}
              >
                <div className={styles.cardHeading} style={{ marginBottom: 10 }}>
                  <div>
                    <p style={{ color: "#a55539" }}>CATALOG</p>
                    <h2 id="catalog-title" style={{ fontSize: 15 }}>Products</h2>
                  </div>
                  <button
                    type="button"
                    className={styles.importButton}
                    onClick={() => productFileRef.current?.click()}
                    style={{ minHeight: 32, padding: "0 9px", color: "#7a4a39", borderColor: "rgba(197, 111, 74, 0.2)", fontSize: 10 }}
                  >
                    <Upload aria-hidden="true" /> Import JSON / CSV
                  </button>
                  <input ref={productFileRef} className={styles.hiddenInput} type="file" accept=".json,.csv,text/csv,application/json" onChange={importProducts} />
                </div>

                {products.length ? (
                  <div className={styles.productList} style={{ maxHeight: 280 }}>
                    {products.slice(0, 24).map((product) => (
                      <article key={product.id} className={styles.productRow}>
                        <div>
                          <strong>{product.name}</strong>
                          <span>{product.description || "No description imported"}</span>
                        </div>
                        <div className={styles.productMeta}>
                          <span>{product.price === null ? "Price unknown" : `${product.currency ? `${product.currency} ` : ""}${product.price}`}</span>
                          <span data-availability={product.availability}>{product.availability}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState} style={{ minHeight: 155, padding: 16 }}>
                    <Package aria-hidden="true" />
                    <strong>No catalog imported yet</strong>
                    <span>Import JSON or CSV when needed.</span>
                  </div>
                )}
              </section>
            </div>
          </div>
        </aside>
      ) : null}
    </>
  );
}
