declare module "cloudflare:workers" {
  export class DurableObject<Env = unknown> {
    protected readonly ctx: {
      storage: {
        get<T>(key: string): Promise<T | undefined>;
        put<T>(key: string, value: T): Promise<void>;
        transaction?<T>(closure: (transaction: {
          get<T>(key: string): Promise<T | undefined>;
          put<T>(key: string, value: T): Promise<void>;
        }) => Promise<T>): Promise<T>;
      };
    };
    protected readonly env: Env;
    constructor(ctx: DurableObject<Env>["ctx"], env: Env);
  }
}
