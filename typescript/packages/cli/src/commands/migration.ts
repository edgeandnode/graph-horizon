import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import { Console, Effect, Schedule } from "effect"
import { NetworkSubgraph } from "../services/network/NetworkSubgraph.js"
import { QoSSubgraph } from "../services/qos/QoSSubgraph.js"
import { blue, Display, green } from "../utils/Display.js"

const HORIZON_VERSION = "1.7.0"
const TEN_DAYS_IN_SECONDS = 10 * 24 * 60 * 60

const RETRY_COUNT = 3
const RETRY_BASE_DELAY_MS = 500

export const fetchIndexerVersion = (indexer: { url: string }) =>
  Effect.tryPromise({
    try: async () => {
      const url = new URL(indexer.url)
      url.pathname = "/version"
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`Failed to fetch ${indexer.url}: ${res.status}`)
      return await res.text()
    },
    catch: (error) => new Error(String(error))
  }).pipe(
    Effect.retry(
      Schedule.exponential(RETRY_BASE_DELAY_MS).pipe(
        Schedule.compose(Schedule.recurs(RETRY_COUNT))
      )
    )
  )

export const fetchGraphNodeVersion = (indexer: { url: string }) =>
  Effect.tryPromise({
    try: async () => {
      const url = new URL(indexer.url)
      url.pathname = "/status"
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "{ version { version } }" })
      })
      if (!res.ok) throw new Error(`Failed to fetch ${indexer.url}/status: ${res.status}`)
      const data = await res.json()
      return data?.data?.version?.version ?? null
    },
    catch: (error) => new Error(String(error))
  }).pipe(
    Effect.retry(
      Schedule.exponential(RETRY_BASE_DELAY_MS).pipe(
        Schedule.compose(Schedule.recurs(RETRY_COUNT))
      )
    )
  )

const migratedOnly = Options.boolean("migrated-only").pipe(
  Options.withDescription("Only show indexers that have migrated to Horizon")
)

export const migration = Command.make(
  "migration",
  { migratedOnly },
  ({ migratedOnly }) =>
    Effect.gen(function*() {
      yield* Display.header("Graph Horizon - Migration Status")

      const network = yield* NetworkSubgraph
      const indexerListResult = yield* network.getIndexerList()

      // Build map of provisioned tokens per indexer
      const provisionedByIndexer = new Map<string, bigint>()
      for (const provision of indexerListResult.provisions) {
        const indexerId = provision.indexer.id.toLowerCase()
        const current = provisionedByIndexer.get(indexerId) ?? BigInt(0)
        provisionedByIndexer.set(indexerId, current + BigInt(provision.tokensProvisioned))
      }

      const indexerCount = indexerListResult.indexers.length
      const indexerWithAllocationsCount = indexerListResult.indexers.filter((indexer) =>
        indexer.allocations.length > 0
      ).length

      const activeIndexers = indexerListResult.indexers.filter((indexer) =>
        indexer.allocations.some((allocation: { status: string }) => allocation.status === "Active")
      )

      const migratedIndexers = activeIndexers.filter((indexer) =>
        indexerListResult.provisions.some((provision) => provision.indexer.id === indexer.id)
      )

      const indexersPendingMigration = activeIndexers.filter((indexer) =>
        !indexerListResult.provisions.some((provision) => provision.indexer.id === indexer.id)
      )

      const indexersWithNoURL = activeIndexers.filter((indexer) =>
        indexer.url === "" || indexer.url === null || indexer.url === undefined
      )

      const indexersWithURL = activeIndexers.filter((indexer) => indexer.url && indexer.url !== "")

      const activeIndexersWithVersions = yield* Effect.forEach(
        indexersWithURL,
        (indexer) =>
          Effect.gen(function*() {
            const [versionResponse, graphNodeVersion] = yield* Effect.all([
              fetchIndexerVersion(indexer).pipe(
                Effect.catchAll((error) => Effect.succeed(`Error: ${error.message} for ${indexer.url}`))
              ),
              fetchGraphNodeVersion(indexer).pipe(
                Effect.catchAll(() => Effect.succeed(null))
              )
            ], { concurrency: "unbounded" })

            let version = null
            try {
              version = JSON.parse(versionResponse).version
            } catch { /* empty */ }

            return {
              ...indexer,
              version,
              graphNodeVersion
            }
          }),
        { concurrency: "unbounded" }
      )

      const unreachableActiveIndexers = activeIndexersWithVersions.filter((indexer) => !indexer.version)
      const reachableActiveIndexers = activeIndexersWithVersions.filter((indexer) => !!indexer.version)

      yield* Display.section("Indexers by activity")
      yield* Display.keyValue("Total Indexers", indexerCount)
      yield* Display.keyValue("Indexers with allocations", indexerWithAllocationsCount)
      yield* Display.keyValue("Active Indexers", activeIndexers.length)

      yield* Display.section("Active indexers by migration status")
      yield* Display.keyValue("Migrated indexers", migratedIndexers.length)
      yield* Display.keyValue("Migration pending", indexersPendingMigration.length)

      yield* Display.section("Active indexers by version")
      yield* Display.keyValue("No URL", indexersWithNoURL.length)
      yield* Display.keyValue("Unreachable", unreachableActiveIndexers.length)
      yield* Display.keyValue("Reachable", reachableActiveIndexers.length)
      yield* Display.keyValue(
        "• Pre-horizon indexer stack",
        reachableActiveIndexers.filter((indexer) => compareVersions(indexer.version, HORIZON_VERSION) < 0).length
      )
      yield* Display.keyValue(
        "• Horizon indexer stack",
        reachableActiveIndexers.filter((indexer) => compareVersions(indexer.version, HORIZON_VERSION) >= 0).length
      )

      // Query volume coverage analysis (optional - requires QOS_SUBGRAPH_URL)
      const qos = yield* QoSSubgraph
      const qosConfigured = qos.isConfigured()

      // Create a set of Horizon indexer IDs (version >= 1.7.0)
      const horizonIndexerIds = new Set(
        reachableActiveIndexers
          .filter((indexer) => compareVersions(indexer.version, HORIZON_VERSION) >= 0)
          .map((indexer) => indexer.id.toLowerCase())
      )

      // Query volume data (fetch if QoS is configured)
      const volumeByIndexer = new Map<string, bigint>()
      const volumeByDay = new Map<string, { total: bigint; horizon: bigint }>()
      let grandTotalQueries = BigInt(0)

      if (qosConfigured) {
        const tenDaysAgo = Math.floor(Date.now() / 1000) - TEN_DAYS_IN_SECONDS
        const dailyData = yield* qos.getIndexerDailyData(tenDaysAgo)

        for (const dataPoint of dailyData.indexerDailyDataPoints) {
          const day = dataPoint.dayStart
          const queryCount = BigInt(dataPoint.query_count)
          const indexerId = dataPoint.indexer.id.toLowerCase()

          // Track by day
          if (!volumeByDay.has(day)) {
            volumeByDay.set(day, { total: BigInt(0), horizon: BigInt(0) })
          }

          const dayData = volumeByDay.get(day)!
          dayData.total += queryCount
          if (horizonIndexerIds.has(indexerId)) {
            dayData.horizon += queryCount
          }

          // Track by indexer
          volumeByIndexer.set(indexerId, (volumeByIndexer.get(indexerId) ?? BigInt(0)) + queryCount)
          grandTotalQueries += queryCount
        }
      }

      // Calculate total network stake metrics
      const totalStaked = indexerListResult.indexers.reduce((acc, indexer) => {
        return acc + BigInt(indexer.stakedTokens ?? 0)
      }, BigInt(0))
      const totalProvisioned = indexerListResult.provisions.reduce((acc, provision) => {
        return acc + BigInt(provision.tokensProvisioned)
      }, BigInt(0))
      const stakePct = totalStaked > 0
        ? ((Number(totalProvisioned) / Number(totalStaked)) * 100).toFixed(2)
        : "N/A"
      const stakeDisplay = totalStaked > 0
        ? `${stakePct}% (${formatGRT(totalProvisioned)} / ${formatGRT(totalStaked)})`
        : "N/A"

      // Calculate query volume coverage
      let queryVolumeDisplay = "N/A (QOS_SUBGRAPH_URL not configured)"
      if (qosConfigured && volumeByDay.size > 0) {
        let totalQueries = BigInt(0)
        let horizonQueries = BigInt(0)
        for (const dayData of volumeByDay.values()) {
          totalQueries += dayData.total
          horizonQueries += dayData.horizon
        }
        const queryPct = totalQueries > 0
          ? ((Number(horizonQueries) / Number(totalQueries)) * 100).toFixed(2)
          : "0.00"
        queryVolumeDisplay = `${queryPct}% (${formatNumber(horizonQueries)} / ${formatNumber(totalQueries)})`
      }

      yield* Display.section("Horizon coverage")
      yield* Display.keyValue("Stake provisioned", stakeDisplay)
      yield* Display.keyValue("Query volume (10d)", queryVolumeDisplay)

      yield* Display.section("Active indexers details")

      // Filter indexers if --migrated-only flag is set (version >= 1.7.0)
      const indexersToDisplay = migratedOnly
        ? activeIndexersWithVersions.filter((indexer) =>
          !!indexer.version && compareVersions(indexer.version, HORIZON_VERSION) >= 0
        )
        : activeIndexersWithVersions

      // Group indexers by version
      const indexersByVersion = indexersToDisplay.reduce((acc, indexer) => {
        const version = indexer.version ?? "N/A"
        if (!acc[version]) {
          acc[version] = []
        }
        acc[version].push(indexer)
        return acc
      }, {} as Record<string, typeof indexersToDisplay>)

      // Sort versions (N/A last, then descending version order)
      const sortedVersions = Object.keys(indexersByVersion).sort((a, b) => {
        if (a === "N/A") return 1
        if (b === "N/A") return -1
        return compareVersions(b, a) // descending order
      })

      // Display grouped by version with query volume and stake
      for (const version of sortedVersions) {
        const indexers = indexersByVersion[version]

        // Calculate total volume for this version
        const versionVolume = indexers.reduce((acc, indexer) => {
          return acc + (volumeByIndexer.get(indexer.id.toLowerCase()) ?? BigInt(0))
        }, BigInt(0))
        const versionQueryPct = qosConfigured && grandTotalQueries > 0
          ? `${((Number(versionVolume) / Number(grandTotalQueries)) * 100).toFixed(2)}%`
          : "N/A"

        // Calculate total stake percentage for this version
        const versionStaked = indexers.reduce((acc, indexer) => {
          return acc + BigInt(indexer.stakedTokens ?? 0)
        }, BigInt(0))
        const versionProvisioned = indexers.reduce((acc, indexer) => {
          return acc + (provisionedByIndexer.get(indexer.id.toLowerCase()) ?? BigInt(0))
        }, BigInt(0))
        const versionStakePct = versionStaked > 0
          ? `${((Number(versionProvisioned) / Number(versionStaked)) * 100).toFixed(2)}%`
          : "N/A"

        yield* Console.log(
          `\n  Version ${version} (${indexers.length} indexer${indexers.length === 1 ? "" : "s"}) - ${
            blue(versionQueryPct)
          }  ${green(versionStakePct)}:`
        )

        for (const indexer of indexers) {
          const indexerVolume = volumeByIndexer.get(indexer.id.toLowerCase()) ?? BigInt(0)
          const queryPct = qosConfigured && grandTotalQueries > 0
            ? `${((Number(indexerVolume) / Number(grandTotalQueries)) * 100).toFixed(2)}%`
            : "N/A"

          const staked = BigInt(indexer.stakedTokens ?? 0)
          const provisioned = provisionedByIndexer.get(indexer.id.toLowerCase()) ?? BigInt(0)
          const stakePct = staked > 0
            ? `${((Number(provisioned) / Number(staked)) * 100).toFixed(2)}%`
            : "N/A"

          yield* Display.sixString(
            indexer.id,
            queryPct,
            stakePct,
            formatGRT(staked),
            indexer.graphNodeVersion ?? "N/A",
            indexer.url ?? "N/A"
          )
        }
      }
    }).pipe(
      Effect.catchAll((error) => {
        return Effect.gen(function*() {
          yield* Display.error(`Failed to fetch migration data: ${error}`)
          return yield* Console.error(error)
        })
      })
    )
).pipe(
  Command.withDescription("Fetch migration data for horizon upgrade")
)

function formatNumber(n: bigint): string {
  return n.toLocaleString()
}

function formatGRT(n: bigint): string {
  const grt = Number(n) / 1e18
  if (grt >= 1_000_000_000) {
    return `${(grt / 1_000_000_000).toFixed(2)}B GRT`
  } else if (grt >= 1_000_000) {
    return `${(grt / 1_000_000).toFixed(2)}M GRT`
  } else if (grt >= 1_000) {
    return `${(grt / 1_000).toFixed(2)}K GRT`
  }
  return `${grt.toFixed(2)} GRT`
}

function parseVersion(v: string) {
  return v.split(".").map(Number)
}

function compareVersions(a: string, b: string) {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}
