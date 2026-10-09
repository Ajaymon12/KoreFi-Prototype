import { adapt } from "./adapters";
import { CONNECTIONS } from "./connections";
import type { SourceConnection, SourceData, SourceGroup, SourceId } from "./types";

// Simulated fetch: async with a little latency so pages behave like they hit a real API.
const LATENCY_MS = 120;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type SourceResult = { connection: SourceConnection; data: SourceData };

export async function fetchSource(id: SourceId): Promise<SourceResult> {
  await wait(LATENCY_MS);
  const connection = CONNECTIONS.find((c) => c.id === id)!;
  // Disconnected or errored sources return nothing; the page shows a status instead of numbers.
  const data = connection.connected && connection.status !== "error" ? adapt(id) : {};
  return { connection, data };
}

export async function fetchGroup(group: SourceGroup): Promise<SourceResult[]> {
  const ids = CONNECTIONS.filter((c) => c.group === group).map((c) => c.id);
  return Promise.all(ids.map(fetchSource));
}

export async function fetchConnections(): Promise<SourceConnection[]> {
  await wait(LATENCY_MS);
  return CONNECTIONS;
}
