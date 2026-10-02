import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabasePublishableKey, supabaseUrl } from "@/lib/auth/client";
import type { IngestedGame, PlayerProfile, TimeClass } from "./types";

const BASE = "https://api.chess.com/pub";
const USER_AGENT = "MoveWisely/5.0 (competition chess training; public API client)";
const CACHE_TTL = 5 * 60 * 1000;
const REQUEST_WINDOW = 15 * 60 * 1000;
const REQUEST_LIMIT = 4;
const MAX_ARCHIVE_MONTHS = 36;
const MAX_CACHE_ENTRIES = 500;
const MAX_REQUEST_LOG_ENTRIES = 5000;

const Input = z.object({
  username: z.string().trim().min(1).max(32).regex(/^[a-z0-9_-]+$/i),
  timeClass: z.enum(["rapid", "blitz", "bullet", "daily"]),
  limit: z.number().int().min(5).max(30),
  accessToken: z.string().min(20).max(5000),
});

type ArchivesResponse = { archives: string[] };
type GamesMonthResponse = {
  games: Array<{
    url: string;
    pgn?: string;
    time_class?: string;
    end_time?: number;
    eco?: string;
    rated?: boolean;
    white: { username: string; rating?: number; result?: string };
    black: { username: string; rating?: number; result?: string };
  }>;
};
type ProfileResponse = { username: string; name?: string; title?: string; avatar?: string; country?: string };
type StatsResponse = Record<string, { last?: { rating?: number }}>;

type CacheEntry = { expires: number; value: FetchResult };
type FetchResult = { ok: true; profile: PlayerProfile; games: IngestedGame[] } | { ok: false; error: string };
const cache = new Map<string, CacheEntry>();
const requestLog = new Map<string, number[]>();

function now() {
  return Date.now();
}

function allowRequest(userId: string): boolean {
  const cutoff = now() - REQUEST_WINDOW;
  const previous = (requestLog.get(userId) ?? []).filter((stamp) => stamp > cutoff);
  if (previous.length >= REQUEST_LIMIT) return false;
  previous.push(now());
  requestLog.set(userId, previous);
  if (requestLog.size > MAX_REQUEST_LOG_ENTRIES) {
    const oldestEntries = [...requestLog.entries()]
      .sort((a, b) => (a[1].at(-1) ?? 0) - (b[1].at(-1) ?? 0))
      .slice(0, Math.ceil(MAX_REQUEST_LOG_ENTRIES * 0.1));
    for (const [staleUserId] of oldestEntries) requestLog.delete(staleUserId);
  }
  return true;
}

async function verifyAccessToken(accessToken: string): Promise<string | null> {
  if (!supabaseUrl || !supabasePublishableKey) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { id?: string };
  return body.id ?? null;
}

async function chessGet<T>(path: string): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const url = path.startsWith("https://") ? path : `${BASE}${path}`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) return { ok: true, data: (await response.json()) as T };
    if (response.status === 429 && attempt === 0) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? "2");
      await new Promise((resolve) => setTimeout(resolve, Math.min(6000, Math.max(750, retryAfter * 1000))));
      continue;
    }
    if (response.status === 404) return { ok: false, status: 404, error: "Chess.com player not found." };
    if (response.status === 429) return { ok: false, status: 429, error: "Chess.com is rate limiting requests. Please wait a few minutes and try again." };
    return { ok: false, status: response.status, error: `Chess.com returned ${response.status}. Try again shortly.` };
  }
  return { ok: false, status: 429, error: "Chess.com rate limit reached." };
}

function statsKey(timeClass: TimeClass) {
  if (timeClass === "rapid") return "chess_rapid";
  if (timeClass === "blitz") return "chess_blitz";
  if (timeClass === "bullet") return "chess_bullet";
  return "chess_daily";
}

export const fetchChessComGames = createServerFn({ method: "POST" })
  .validator(Input)
  .handler(async ({ data }) => {
    const userId = await verifyAccessToken(data.accessToken);
    if (!userId) return { ok: false as const, error: "Your session is invalid or expired. Sign in again." };

    const username = data.username.toLowerCase();
    const cacheKey = `${username}:${data.timeClass}:${data.limit}`;
    const hit = cache.get(cacheKey);
    if (hit && hit.expires > now()) return hit.value;
    if (!allowRequest(userId)) return { ok: false as const, error: "Scan limit reached. Please wait before starting another Chess.com scan." };

    const profileRes = await chessGet<ProfileResponse>(`/player/${encodeURIComponent(username)}`);
    if (!profileRes.ok) return { ok: false as const, error: profileRes.error };
    const statsRes = await chessGet<StatsResponse>(`/player/${encodeURIComponent(username)}/stats`);
    const archivesRes = await chessGet<ArchivesResponse>(`/player/${encodeURIComponent(username)}/games/archives`);
    if (!archivesRes.ok) return { ok: false as const, error: archivesRes.error };

    const rating = statsRes.ok ? statsRes.data[statsKey(data.timeClass)]?.last?.rating : undefined;
    const games: IngestedGame[] = [];
    const archives = [...archivesRes.data.archives].reverse().slice(0, MAX_ARCHIVE_MONTHS);

    for (const archive of archives) {
      if (games.length >= data.limit) break;
      const month = await chessGet<GamesMonthResponse>(archive);
      if (!month.ok) continue;
      for (const game of [...month.data.games].reverse()) {
        if (game.time_class !== data.timeClass || !game.pgn) continue;
        games.push({
          url: /^https:\/\//i.test(game.url) ? game.url : "",
          pgn: game.pgn,
          timeClass: game.time_class,
          endTime: game.end_time ?? 0,
          eco: game.eco,
          rated: game.rated,
          white: game.white,
          black: game.black,
        });
        if (games.length >= data.limit) break;
      }
    }

    if (!games.length) return { ok: false as const, error: `No ${data.timeClass} public games were found for ${username}.` };
    const profile: PlayerProfile = {
      username: profileRes.data.username,
      name: profileRes.data.name,
      title: profileRes.data.title,
      avatar: undefined,
      country: profileRes.data.country,
      rating,
    };
    const value: FetchResult = { ok: true, profile, games };
    cache.set(cacheKey, { value, expires: now() + CACHE_TTL });

    return value;
  });
