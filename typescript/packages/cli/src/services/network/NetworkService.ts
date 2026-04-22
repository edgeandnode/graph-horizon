import { Schema } from "@effect/schema"
import type { ParseError } from "@effect/schema/ParseResult"
import { Context, Effect, Layer } from "effect"
import type { NetworkRPCError } from "./NetworkRPC.js"
import { NetworkRPC } from "./NetworkRPC.js"
import type { NetworkSubgraphError } from "./NetworkSubgraph.js"
import { NetworkSubgraph } from "./NetworkSubgraph.js"
import { DisputeManager } from "./schemas/DisputeManager.js"
import { GraphNetwork } from "./schemas/GraphNetwork.js"
import { Indexer } from "./schemas/Indexer.js"
import { SubgraphService } from "./schemas/SubgraphService.js"

export interface DataMismatch {
  key: string
  rpcValue: unknown
  subgraphValue: unknown
}

export interface NetworkResult<T> {
  data: T
  mismatches: Array<DataMismatch>
}

export type NetworkServiceError = NetworkSubgraphError | NetworkRPCError | ParseError

export class NetworkService extends Context.Tag("NetworkService")<NetworkService, {
  getGraphNetwork: () => Effect.Effect<NetworkResult<GraphNetwork>, NetworkServiceError>
  getSubgraphService: () => Effect.Effect<NetworkResult<SubgraphService>, NetworkServiceError>
  getDisputeManager: () => Effect.Effect<NetworkResult<DisputeManager>, NetworkServiceError>
  getIndexer: (address: string) => Effect.Effect<NetworkResult<Indexer>, NetworkServiceError>
}>() {}

export const NetworkServiceLive = Layer.effect(
  NetworkService,
  Effect.gen(function*() {
    const rpc = yield* NetworkRPC
    const subgraph = yield* NetworkSubgraph

    const getGraphNetwork = () =>
      Effect.gen(function*() {
        const [rpcData, subgraphData] = yield* Effect.all(
          [rpc.getGraphNetwork(), subgraph.getGraphNetwork()],
          { concurrency: "unbounded" }
        )

        const mismatches = findMismatches(rpcData, subgraphData)
        const validatedData = yield* Schema.decodeUnknown(GraphNetwork)(rpcData)

        return {
          data: validatedData,
          mismatches
        }
      })

    const getSubgraphService = () =>
      Effect.gen(function*() {
        const [rpcData, subgraphData] = yield* Effect.all(
          [rpc.getSubgraphService(), subgraph.getSubgraphService()],
          { concurrency: "unbounded" }
        )

        const mismatches = findMismatches(rpcData, subgraphData)
        const validatedData = yield* Schema.decodeUnknown(SubgraphService)(rpcData)

        return {
          data: validatedData,
          mismatches
        }
      })

    const getDisputeManager = () =>
      Effect.gen(function*() {
        const [rpcData, subgraphData] = yield* Effect.all(
          [rpc.getDisputeManager(), subgraph.getDisputeManager()],
          { concurrency: "unbounded" }
        )

        const mismatches = findMismatches(rpcData, subgraphData)
        const validatedData = yield* Schema.decodeUnknown(DisputeManager)(rpcData)

        return {
          data: validatedData,
          mismatches
        }
      })

    const getIndexer = (address: string) =>
      Effect.gen(function*() {
        const [rpcData, subgraphData] = yield* Effect.all(
          [rpc.getIndexer(address), subgraph.getIndexer(address)],
          { concurrency: "unbounded" }
        )

        const mismatches = findMismatches(rpcData, subgraphData)
        const validatedData = yield* Schema.decodeUnknown(Indexer)(rpcData)

        return {
          data: validatedData,
          mismatches
        }
      })

    return NetworkService.of({
      getGraphNetwork,
      getSubgraphService,
      getDisputeManager,
      getIndexer
    })
  })
)

function findMismatches(a: unknown, b: unknown): Array<DataMismatch> {
  const mismatches: Array<DataMismatch> = []

  // If both are objects, compare each key
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const aObj = a as Record<string, unknown>
    const bObj = b as Record<string, unknown>

    const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)])

    for (const key of allKeys) {
      const aValue = aObj[key]
      const bValue = bObj[key]

      if (!deepEqual(aValue, bValue)) {
        mismatches.push({
          key,
          rpcValue: aValue,
          subgraphValue: bValue
        })
      }
    }
  } else if (!deepEqual(a, b)) {
    mismatches.push({
      key: "root",
      rpcValue: a,
      subgraphValue: b
    })
  }

  return mismatches
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true

  // BigInts
  if (typeof a === "bigint" && typeof b === "bigint") {
    return a === b
  }

  // Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]))
  }

  // Objects
  if (a && b && typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a as any)
    const bKeys = Object.keys(b as any)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every((k) => deepEqual((a as any)[k], (b as any)[k]))
  }

  return false
}
