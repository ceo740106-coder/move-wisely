import handler from "@tanstack/react-start/server-entry";

type EdgeRateLimiter = { limit: (args: { key: string }) => Promise<{ success: boolean }> };
type WorkerEnv = { MOVEWISELY_EDGE_LIMITER?: EdgeRateLimiter };
type StartHandler = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};
type HtmlElement = { setAttribute: (name: string, value: string) => void };
type HtmlRewriter = {
  on: (selector: string, handler: { element: (element: HtmlElement) => void }) => HtmlRewriter;
  transform: (response: Response) => Response;
};
type HtmlRewriterConstructor = new () => HtmlRewriter;

const startHandler = handler as unknown as StartHandler;

function makeCsp(nonce: string) {
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'`,
    "script-src-attr 'none'",
    "style-src 'self'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const baseSecurityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Origin-Agent-Cluster": "?1",
  "X-Permitted-Cross-Domain-Policies": "none",
  "X-DNS-Prefetch-Control": "off",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};


async function actorKey(request: Request): Promise<string> {
  const actor = request.headers.get("Authorization") || request.headers.get("cf-connecting-ip") || "anonymous";
  const bytes = new TextEncoder().encode(actor);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function applyEdgeRateLimit(request: Request, env: WorkerEnv): Promise<Response | null> {
  if (request.method !== "POST" || !env.MOVEWISELY_EDGE_LIMITER) return null;
  const url = new URL(request.url);
  const key = `${url.pathname}:${await actorKey(request)}`;
  try {
    const { success } = await env.MOVEWISELY_EDGE_LIMITER.limit({ key });
    if (!success) {
      return new Response(JSON.stringify({ error: "Too many requests. Please try again shortly." }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }
  } catch {
    // The binding is a defense-in-depth layer. Supabase authentication and the
    // application-level Chess.com scan limit still protect the sensitive path.
  }
  return null;
}

function secureResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  const nonce = crypto.randomUUID().replaceAll("-", "");
  for (const [name, value] of Object.entries(baseSecurityHeaders)) headers.set(name, value);
  headers.set("Content-Security-Policy", makeCsp(nonce));

  const contentType = headers.get("content-type") ?? "";
  if (contentType.includes("text/html") || contentType.includes("application/json")) headers.set("Cache-Control", "no-store");
  if (!contentType.includes("text/html") || !response.body) {
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  const Rewriter = (globalThis as typeof globalThis & { HTMLRewriter?: HtmlRewriterConstructor }).HTMLRewriter;
  if (!Rewriter) {
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  const rewritten = new Rewriter()
    .on("script", { element: (element) => element.setAttribute("nonce", nonce) })
    .on("style", { element: (element) => element.setAttribute("nonce", nonce) })
    .transform(response);
  return new Response(rewritten.body, { status: rewritten.status, statusText: rewritten.statusText, headers });
}

export default {
  fetch: async (request: Request, env: unknown, ctx: unknown) => {
    const limited = await applyEdgeRateLimit(request, (env ?? {}) as WorkerEnv);
    if (limited) return secureResponse(limited);
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 262_144) {
      return secureResponse(new Response(JSON.stringify({ error: "Request body too large." }), {
        status: 413,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }));
    }
    return secureResponse(await startHandler.fetch(request, env, ctx));
  },
};
