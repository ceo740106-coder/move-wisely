import { ENGINE_MATE_CP, type EngineLine } from "./types";

export const ENGINE_VERSION = "Stockfish 19 lite single-threaded";
export const ANALYSIS_VERSION = "2.0.0";
export const DEFAULT_ENGINE_DEPTH = 13;
export const CONFIRM_ENGINE_DEPTH = 18;
export const ENGINE_HASH_MB = 48;
export const ENGINE_THREADS = 1;
const ENGINE_SCRIPT = "/engine/stockfish-19-lite-single.js";

type Pending = {
  resolve: (line: EngineLine) => void;
  reject: (error: Error) => void;
  depth: number;
  bestMove?: string;
  lastScore?: number;
  lastMate?: number;
  pv: string[];
  nodes?: number;
  timeMs?: number;
  startedAt: number;
  timeoutId?: number;
};

function parseScore(line: string): { scoreCp: number; mate?: number } | null {
  const match = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
  if (!match) return null;
  const value = Number(match[2]);
  if (match[1] === "mate") {
    return {
      scoreCp: value > 0 ? ENGINE_MATE_CP - Math.abs(value) * 100 : -ENGINE_MATE_CP + Math.abs(value) * 100,
      mate: value,
    };
  }
  return { scoreCp: value };
}

export function parseEngineInfo(
  line: string,
): { depth: number; scoreCp: number; mate?: number; pv: string[]; nodes?: number; timeMs?: number } | null {
  if (!line.startsWith("info ")) return null;
  const depthMatch = line.match(/\bdepth\s+(\d+)/);
  const score = parseScore(line);
  if (!depthMatch || !score) return null;
  const pvIndex = line.indexOf(" pv ");
  const pv = pvIndex >= 0 ? line.slice(pvIndex + 4).trim().split(/\s+/).filter(Boolean) : [];
  const nodesMatch = line.match(/\bnodes\s+(\d+)/);
  const timeMatch = line.match(/\btime\s+(\d+)/);
  return {
    depth: Number(depthMatch[1]),
    scoreCp: score.scoreCp,
    mate: score.mate,
    pv,
    nodes: nodesMatch ? Number(nodesMatch[1]) : undefined,
    timeMs: timeMatch ? Number(timeMatch[1]) : undefined,
  };
}

function isUciMove(value?: string): value is string {
  return !!value && /^(?:[a-h][1-8]){2}[qrbn]?$/.test(value);
}

class EngineClient {
  private worker: Worker | null = null;
  private ready = false;
  private pending: Pending | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private bootPromise: Promise<void> | null = null;
  private cache = new Map<string, EngineLine>();

  private async boot(): Promise<void> {
    if (this.worker && this.ready) return;
    if (this.bootPromise) return this.bootPromise;

    this.bootPromise = (async () => {
      this.worker?.terminate();
      this.ready = false;
      const worker = new Worker(ENGINE_SCRIPT);
      this.worker = worker;
      worker.onerror = () => this.fail(new Error("The chess engine stopped unexpectedly. Reload the page and try again."));
      await this.waitForExact("uciok", 15000, "uci");
      this.send("setoption name Hash value " + ENGINE_HASH_MB);
      this.send("setoption name Ponder value false");
      this.send("setoption name MultiPV value 1");
      await this.waitForExact("readyok", 15000, "isready");
      this.ready = true;
    })();

    try {
      await this.bootPromise;
    } finally {
      this.bootPromise = null;
    }
  }

  private send(command: string) {
    this.worker?.postMessage(command);
  }

  private waitForExact(expected: string, timeoutMs: number, command: string) {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error("Chess engine worker is unavailable."));
    return new Promise<void>((resolve, reject) => {
      const onMessage = (event: MessageEvent) => {
        if (String(event.data ?? "") !== expected) return;
        cleanup();
        resolve();
      };
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error("Chess engine initialization timed out."));
      }, timeoutMs);
      const cleanup = () => {
        window.clearTimeout(timer);
        worker.removeEventListener("message", onMessage);
      };
      worker.addEventListener("message", onMessage);
      worker.postMessage(command);
    });
  }

  private fail(error: Error) {
    const pending = this.pending;
    this.pending = null;
    if (pending?.timeoutId !== undefined) window.clearTimeout(pending.timeoutId);
    this.ready = false;
    pending?.reject(error);
  }

  private onLine(raw: string) {
    const line = raw.trim();
    if (!line || !this.pending) return;
    const pending = this.pending;

    if (line.startsWith("bestmove")) {
      const move = line.split(/\s+/)[1];
      this.pending = null;
      if (pending.timeoutId !== undefined) window.clearTimeout(pending.timeoutId);
      pending.resolve({
        scoreCp: pending.lastScore ?? 0,
        mate: pending.lastMate,
        depth: pending.depth,
        bestMoveUci: isUciMove(move) ? move : undefined,
        pv: pending.pv,
        nodes: pending.nodes,
        timeMs: pending.timeMs ?? Date.now() - pending.startedAt,
      });
      return;
    }

    const info = parseEngineInfo(line);
    if (!info) return;
    if (info.depth <= pending.depth) {
      pending.lastScore = info.scoreCp;
      pending.lastMate = info.mate;
      pending.pv = info.pv;
      pending.nodes = info.nodes;
      pending.timeMs = info.timeMs;
    }
  }

  private async run(fen: string, depth: number, searchMoves?: string[]): Promise<EngineLine> {
    await this.boot();
    const worker = this.worker;
    if (!worker) throw new Error("Chess engine worker is unavailable.");
    if (this.pending) throw new Error("Chess engine is busy.");

    this.send("ucinewgame");
    await this.waitForExact("readyok", 10000, "isready");

    return new Promise((resolve, reject) => {
      const timeoutMs = Math.min(60000, Math.max(20000, 12000 + depth * 2600));
      const timeoutId = window.setTimeout(() => {
        this.send("stop");
        this.fail(new Error("Chess engine analysis timed out. Try fewer games or a lower analysis depth."));
      }, timeoutMs);
      this.pending = {
        resolve,
        reject,
        depth,
        pv: [],
        startedAt: Date.now(),
        timeoutId,
      };
      this.send(`position fen ${fen}`);
      this.send(`go depth ${Math.max(8, Math.min(20, depth))}${searchMoves?.length ? ` searchmoves ${searchMoves.join(" ")}` : ""}`);
    });
  }

  analyze(fen: string, depth = DEFAULT_ENGINE_DEPTH, searchMoves?: string[]): Promise<EngineLine> {
    const normalizedDepth = Math.max(8, Math.min(20, depth));
    const key = `${fen}|${normalizedDepth}|${searchMoves?.join(",") ?? ""}`;
    const cached = this.cache.get(key);
    if (cached) return Promise.resolve(cached);
    const job = this.queue.then(async () => {
      const existing = this.cache.get(key);
      if (existing) return existing;
      const result = await this.run(fen, normalizedDepth, searchMoves);
      this.cache.set(key, result);
      if (this.cache.size > 1500) {
        const oldest = this.cache.keys().next().value as string | undefined;
        if (oldest) this.cache.delete(oldest);
      }
      return result;
    });
    this.queue = job.catch(() => undefined);
    return job;
  }

  terminate() {
    this.pending = null;
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.bootPromise = null;
    this.cache.clear();
  }
}

let singleton: EngineClient | null = null;

export function getChessEngine(): EngineClient {
  if (typeof window === "undefined") throw new Error("The chess engine runs in the browser.");
  singleton ??= new EngineClient();
  return singleton;
}
