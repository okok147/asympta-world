declare module "cloudflare:workers" {
  type DurableObjectTransaction = {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
  };

  type DurableObjectContext = {
    storage: {
      transaction<T>(closure: (transaction: DurableObjectTransaction) => Promise<T>): Promise<T>;
    };
  };

  export class DurableObject<Env = unknown> {
    protected readonly ctx: DurableObjectContext;
    protected readonly env: Env;
    constructor(ctx: unknown, env: Env);
  }
}
