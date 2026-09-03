"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
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
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
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

  const tabButton = (tab: BusinessWorkspaceTab, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      className={styles.importButton}
      aria-pressed={workspaceTab === tab}
      onClick={() => setWorkspaceTab(tab)}
      style={workspaceTab === tab ? {
        borderColor: BUSINESS_ACCENT,
        background: BUSINESS_ACCENT,
        color: "#fff8f2",
      } : {
        borderColor: "rgba(197, 111, 74, 0.18)",
        color: "#6c4335",
        background: "rgba(255,255,255,0.58)",
      }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <>
      <nav className={styles.modeSwitch} aria-label="Asympta World mode">
        <button
          type="button"
          className={mode === "users" ? styles.modeActive : ""}
          aria-pressed={mode === "users"}
          onClick={() => setMode("users")}
        >
          <Users aria-hidden="true" />
          <span>Users</span>
        </button>
        <button
          type="button"
          className={mode === "business" ? styles.modeActive : ""}
          aria-pressed={mode === "business"}
          onClick={() => {
            setMode("business");
            setWorkspaceOpen(true);
          }}
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
          aria-label="Business agent workspace"
          style={{
            position: "fixed",
            zIndex: 2147483400,
            top: "82px",
            right: "18px",
            bottom: "auto",
            left: "auto",
            width: "min(440px, calc(100vw - 28px))",
            maxHeight: "calc(100dvh - 104px)",
            overflow: "hidden",
            borderColor: "rgba(197, 111, 74, 0.3)",
            background: "rgba(250, 247, 239, 0.96)",
            boxShadow: "0 18px 54px rgba(63, 45, 36, 0.16)",
            backdropFilter: "blur(18px)",
          }}
        >
          <div
            className="atlas-agent-card__top"
            style={{
              borderBottom: workspaceOpen ? "1px solid rgba(197, 111, 74, 0.14)" : "0",
              paddingBottom: workspaceOpen ? "12px" : undefined,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "grid",
                placeItems: "center",
                width: "42px",
                height: "42px",
                flex: "0 0 auto",
                borderRadius: "14px",
                color: "#fff8f2",
                background: BUSINESS_ACCENT,
                boxShadow: `0 8px 22px ${BUSINESS_ACCENT_SOFT}`,
              }}
            >
              <Building2 size={20} strokeWidth={1.8} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <strong>{profile.name || "Business agent"}</strong>
              <small>Business lens · same living world · {availableCount} available</small>
            </div>
            <button
              type="button"
              className="atlas-card-close"
              aria-label={workspaceOpen ? "Collapse business workspace" : "Expand business workspace"}
              aria-expanded={workspaceOpen}
              onClick={() => setWorkspaceOpen((current) => !current)}
              style={{ color: "#7a4a39" }}
            >
              {workspaceOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </button>
          </div>

          {workspaceOpen ? (
            <>
              <div
                role="tablist"
                aria-label="Business workspace sections"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "7px",
                  padding: "12px 12px 0",
                }}
              >
                {tabButton("agent", "Agent", <MessageSquare size={14} aria-hidden="true" />)}
                {tabButton("profile", "Business", <Building2 size={14} aria-hidden="true" />)}
                {tabButton("catalog", "Products", <Package size={14} aria-hidden="true" />)}
              </div>

              <div
                style={{
                  maxHeight: "calc(100dvh - 245px)",
                  padding: "12px",
                  overflow: "auto",
                  overscrollBehavior: "contain",
                }}
              >
                {importError ? <div className={styles.error} role="alert">{importError}</div> : null}

                {workspaceTab === "agent" ? (
                  <section
                    className={`${styles.card} ${styles.communicationCard}`}
                    aria-labelledby="communication-title"
                    style={{
                      padding: "16px",
                      borderColor: "rgba(197, 111, 74, 0.16)",
                      boxShadow: "none",
                      background: "rgba(247, 243, 233, 0.78)",
                    }}
                  >
                    <div className={styles.cardHeading}>
                      <div>
                        <p style={{ color: "#a55539" }}>LIVE</p>
                        <h2 id="communication-title">Business Agent ↔ Customer Agent</h2>
                      </div>
                      <span className={styles.localBadge} style={{ color: "#8a513d", background: BUSINESS_ACCENT_SOFT }}>
                        <MessageSquare aria-hidden="true" /> Local simulation
                      </span>
                    </div>

                    <div className={styles.thread} aria-live="polite" style={{ minHeight: "180px", maxHeight: "310px" }}>
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
                        <div className={styles.threadEmpty}>
                          The map stays alive while this business agent answers customer agents from imported facts only.
                        </div>
                      )}
                    </div>

                    <div className={styles.composer}>
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
                      />
                      <button
                        type="button"
                        onClick={runBusinessAgent}
                        disabled={!inquiry.trim()}
                        style={{ borderColor: BUSINESS_ACCENT, background: BUSINESS_ACCENT, color: "#fff8f2" }}
                      >
                        <Send aria-hidden="true" /> Run communication
                      </button>
                    </div>
                  </section>
                ) : null}

                {workspaceTab === "profile" ? (
                  <section
                    className={styles.card}
                    aria-labelledby="business-info-title"
                    style={{
                      padding: "16px",
                      borderColor: "rgba(197, 111, 74, 0.16)",
                      boxShadow: "none",
                      background: "rgba(247, 243, 233, 0.78)",
                    }}
                  >
                    <div className={styles.cardHeading}>
                      <div>
                        <p style={{ color: "#a55539" }}>BUSINESS</p>
                        <h2 id="business-info-title">Business information</h2>
                      </div>
                      <button
                        type="button"
                        className={styles.importButton}
                        onClick={() => businessFileRef.current?.click()}
                        style={{ color: "#7a4a39", borderColor: "rgba(197, 111, 74, 0.2)" }}
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
                ) : null}

                {workspaceTab === "catalog" ? (
                  <section
                    className={styles.card}
                    aria-labelledby="catalog-title"
                    style={{
                      padding: "16px",
                      borderColor: "rgba(197, 111, 74, 0.16)",
                      boxShadow: "none",
                      background: "rgba(247, 243, 233, 0.78)",
                    }}
                  >
                    <div className={styles.cardHeading}>
                      <div>
                        <p style={{ color: "#a55539" }}>CATALOG</p>
                        <h2 id="catalog-title">Products</h2>
                      </div>
                      <button
                        type="button"
                        className={styles.importButton}
                        onClick={() => productFileRef.current?.click()}
                        style={{ color: "#7a4a39", borderColor: "rgba(197, 111, 74, 0.2)" }}
                      >
                        <Upload aria-hidden="true" /> Import JSON / CSV
                      </button>
                      <input ref={productFileRef} className={styles.hiddenInput} type="file" accept=".json,.csv,text/csv,application/json" onChange={importProducts} />
                    </div>

                    {products.length ? (
                      <div className={styles.productList} style={{ maxHeight: "430px" }}>
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
                      <div className={styles.emptyState} style={{ minHeight: "220px" }}>
                        <Package aria-hidden="true" />
                        <strong>No catalog imported yet</strong>
                        <span>Use JSON or CSV with name, description, price, currency and availability fields.</span>
                      </div>
                    )}
                  </section>
                ) : null}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 14px 12px",
                  borderTop: "1px solid rgba(197, 111, 74, 0.12)",
                  color: "#76665f",
                  fontSize: "10px",
                  lineHeight: 1.45,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "7px",
                    height: "7px",
                    flex: "0 0 auto",
                    borderRadius: "50%",
                    background: BUSINESS_ACCENT,
                    boxShadow: `0 0 0 4px ${BUSINESS_ACCENT_SOFT}`,
                  }}
                />
                Same world, same movement and interaction language. Business is a warm-colour lens, not a separate dashboard.
              </div>
            </>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}
