declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

declare module 'npm:@supabase/supabase-js@2.106.2' {
  export function createClient(
    url: string,
    key: string,
    options?: Record<string, unknown>,
  ): any;
}

