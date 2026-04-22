import { Context, Data, Effect, Layer } from "effect"
import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import { ConfigService } from "../ConfigService.js"

export class QoSSubgraphError extends Data.TaggedError("QoSSubgraphError")<{
  message: string
  query?: string
  variables?: unknown
}> {}

export type IndexerDailyDataPoint = {
  indexer: { id: string }
  dayStart: string
  query_count: string
}

export type IndexerDailyDataResponse = {
  indexerDailyDataPoints: Array<IndexerDailyDataPoint>
}

type QoSDataSource = {
  isConfigured: () => boolean
  getIndexerDailyData: (dayStartGt: number) => Effect.Effect<IndexerDailyDataResponse, QoSSubgraphError>
}

export class QoSSubgraph extends Context.Tag("QoSSubgraph")<QoSSubgraph, QoSDataSource>() {
  static loadQuery(queryName: string) {
    return Effect.sync(() => {
      const queriesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "queries")
      const query = fs.readFileSync(path.join(queriesDir, `${queryName}.graphql`), "utf-8").trim()
      return query
    })
  }
}

export const QoSSubgraphLive = Layer.effect(
  QoSSubgraph,
  Effect.gen(function*() {
    const config = yield* ConfigService
    const qosSubgraphUrl = config.qosSubgraphUrl

    const query = <T>(queryStr: string, variables?: Record<string, unknown>) =>
      Effect.gen(function*() {
        if (!qosSubgraphUrl) {
          return yield* Effect.fail(
            new QoSSubgraphError({
              message: "QoS subgraph URL not configured"
            })
          )
        }

        const response = yield* Effect.tryPromise({
          try: () =>
            fetch(qosSubgraphUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.studioApiKey}`
              },
              body: JSON.stringify({
                query: queryStr,
                variables
              })
            }),
          catch: (error) =>
            new QoSSubgraphError({
              message: `Failed to fetch from QoS subgraph: ${error}`,
              query: queryStr,
              variables
            })
        })

        if (!response.ok) {
          return yield* Effect.fail(
            new QoSSubgraphError({
              message: `QoS subgraph request failed: ${response.status} ${response.statusText}`,
              query: queryStr,
              variables
            })
          )
        }

        const data = yield* Effect.tryPromise({
          try: () => response.json() as Promise<{ data?: T; errors?: Array<{ message: string }> }>,
          catch: (error) =>
            new QoSSubgraphError({
              message: `Failed to parse QoS subgraph response: ${error}`,
              query: queryStr,
              variables
            })
        })

        if (data.errors && data.errors.length > 0) {
          return yield* Effect.fail(
            new QoSSubgraphError({
              message: `GraphQL errors: ${data.errors.map((e) => e.message).join(", ")}`,
              query: queryStr,
              variables
            })
          )
        }

        if (!data.data) {
          return yield* Effect.fail(
            new QoSSubgraphError({
              message: "No data returned from QoS subgraph",
              query: queryStr,
              variables
            })
          )
        }

        return data.data
      })

    const isConfigured = () => qosSubgraphUrl !== undefined

    const getIndexerDailyData = (dayStartGt: number) =>
      Effect.gen(function*() {
        const queryData = yield* QoSSubgraph.loadQuery("IndexerDailyData")
        const rawResult = yield* query<IndexerDailyDataResponse>(queryData, {
          dayStart_gt: dayStartGt.toString()
        })
        if (!rawResult.indexerDailyDataPoints) {
          throw new QoSSubgraphError({
            message: "Indexer daily data not found"
          })
        }
        return rawResult
      })

    return QoSSubgraph.of({
      isConfigured,
      getIndexerDailyData
    })
  })
)
