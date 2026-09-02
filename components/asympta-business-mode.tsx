"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Briefcase,
  Building2,
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
  const [profile, setProfile] = useState<AsymptaBusinessProfile>({ ...EMPTY_ASYMPTA_BUSINESS_PROFILE });
  const [products, setProducts] = useState<AsymptaBusinessProduct[]>([]);
  const [thread, setThread] = useState<BusinessThreadMessage[]>([]);
  const [inquiry, setInquiry] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const businessFileRef = useRef<HTMLInputElement>(null);
  const productFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedMode = window.localStorage.getItem(MODE_KEY);
    if (savedMode === "business") setMode("business");
    setProfile(readJson(PROFILE_KEY, { ...EMPTY_ASYMPTA_BUSINESS_PROFILE }));
    setProducts(readJson(PRODUCTS_KEY, [] as AsymptaBusinessProduct[]));
    setThread(readJson(THREAD_KEY, [] as BusinessThreadMessage[]));
  }, []);

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

  return (
    <>
      <nav className={`${styles.modeSwitch} ${mode === "business" ? styles.modeSwitchBusiness : ""}`} aria-label="Asympta World mode">
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
          onClick={() => setMode("business")}
        >
          <Briefcase aria-hidden="true" />
          <span>Business</span>
        </button>
      </nav>

      {mode === "business" ? (
        <main className={styles.businessWorld} data-asympta-business-world="true">
          <div className={styles.businessBackdrop} aria-hidden="true" />
          <section className={styles.shell}>
            <header className={styles.hero}>
              <div>
                <p className={styles.eyebrow}>Asympta World · Business</p>
                <h1>Build the business side of the agent world.</h1>
                <p>
                  Import what your business actually knows, then let your business agent communicate with customer agents without inventing products, prices, availability, or promises.
                </p>
              </div>
              <div className={styles.heroStatus}>
                <span><Building2 aria-hidden="true" /> {profile.name || "Business not imported"}</span>
                <span><Package aria-hidden="true" /> {products.length} products · {availableCount} available</span>
              </div>
            </header>

            {importError ? <div className={styles.error} role="alert">{importError}</div> : null}

            <div className={styles.grid}>
              <section className={styles.card} aria-labelledby="business-info-title">
                <div className={styles.cardHeading}>
                  <div>
                    <p>01</p>
                    <h2 id="business-info-title">Business information</h2>
                  </div>
                  <button type="button" className={styles.importButton} onClick={() => businessFileRef.current?.click()}>
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

              <section className={styles.card} aria-labelledby="catalog-title">
                <div className={styles.cardHeading}>
                  <div>
                    <p>02</p>
                    <h2 id="catalog-title">Products</h2>
                  </div>
                  <button type="button" className={styles.importButton} onClick={() => productFileRef.current?.click()}>
                    <Upload aria-hidden="true" /> Import JSON / CSV
                  </button>
                  <input ref={productFileRef} className={styles.hiddenInput} type="file" accept=".json,.csv,text/csv,application/json" onChange={importProducts} />
                </div>

                {products.length ? (
                  <div className={styles.productList}>
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
                  <div className={styles.emptyState}>
                    <Package aria-hidden="true" />
                    <strong>No catalog imported yet</strong>
                    <span>Use JSON or CSV with name, description, price, currency and availability fields.</span>
                  </div>
                )}
              </section>

              <section className={`${styles.card} ${styles.communicationCard}`} aria-labelledby="communication-title">
                <div className={styles.cardHeading}>
                  <div>
                    <p>03</p>
                    <h2 id="communication-title">Business Agent ↔ Customer Agent</h2>
                  </div>
                  <span className={styles.localBadge}><MessageSquare aria-hidden="true" /> Local protocol simulation</span>
                </div>

                <div className={styles.thread} aria-live="polite">
                  {thread.length ? thread.map((message) => (
                    <article key={message.id} className={message.role === "business_agent" ? styles.businessMessage : styles.customerMessage}>
                      <span>{message.role === "business_agent" ? "Business agent" : "Customer agent"}</span>
                      <p>{message.text}</p>
                      {message.status === "needs_business_confirmation" ? <small>Needs business confirmation</small> : null}
                    </article>
                  )) : (
                    <div className={styles.threadEmpty}>
                      Customer agents can ask about imported business information and products. Unknown facts stay unresolved instead of being invented.
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
                  <button type="button" onClick={runBusinessAgent} disabled={!inquiry.trim()}>
                    <Send aria-hidden="true" /> Run communication
                  </button>
                </div>
              </section>
            </div>
          </section>
        </main>
      ) : null}
    </>
  );
}
