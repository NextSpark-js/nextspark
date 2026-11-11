/** Whether `initdb` and `pg_ctl` are on the PATH: without them no cluster can start. */
export const HAS_POSTGRES: boolean

export interface ThrowawayCluster {
  dir: string
  data: string
  port: number
  /** Stops the server (even if it is half started) and removes the directory. Safe to call twice. */
  stop(): void
}

export interface ClusterOptions {
  /** Called once the data directory exists and before the server starts; returns more server options (`-c ssl=on`). */
  prepare?(dir: string, data: string): string
}

/** A TCP port nothing listens on right now. */
export function freePort(): Promise<number>

/** Starts a cluster in a new temporary directory named after `prefix`; the caller owns `stop()`. */
export function startCluster(prefix: string, options?: ClusterOptions): Promise<ThrowawayCluster>

/** The connection URL of a database of the cluster (the default `postgres`), as the owner, with SSL off. */
export function clusterUrl(cluster: ThrowawayCluster, database?: string): string
