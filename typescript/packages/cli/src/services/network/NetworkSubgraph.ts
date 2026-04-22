import { connectGraphHorizon } from "@graphprotocol/toolshed/deployments"
import { Context, Data, Effect, Layer } from "effect"
import { JsonRpcProvider } from "ethers"
import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import { ConfigService } from "../ConfigService.js"
import type { NetworkDataSource } from "./NetworkDataSource.js"
import type { DisputeManagerSubgraphResponse } from "./schemas/DisputeManager.js"
import type { GraphNetworkSubgraphResponse } from "./schemas/GraphNetwork.js"
import type { IndexerSubgraphResponse } from "./schemas/Indexer.js"
import type { SubgraphServiceSubgraphResponse } from "./schemas/SubgraphService.js"

export class NetworkSubgraphError extends Data.TaggedError("NetworkSubgraphError")<{
  message: string
  query?: string
  variables?: unknown
}> {}

type ExtendedNetworkDataSource = NetworkDataSource & {
  getIndexerList: () => Effect.Effect<IndexerSubgraphResponse, NetworkSubgraphError>
}

export class NetworkSubgraph extends Context.Tag("NetworkSubgraph")<NetworkSubgraph, ExtendedNetworkDataSource>() {
  static loadQuery(queryName: string) {
    return Effect.sync(() => {
      const queriesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "queries")
      const query = fs.readFileSync(path.join(queriesDir, `${queryName}.graphql`), "utf-8").trim()
      return query
    })
  }
}

export const NetworkSubgraphlive = Layer.effect(
  NetworkSubgraph,
  Effect.gen(function*() {
    const config = yield* ConfigService

    const query = <T>(query: string, variables?: Record<string, unknown>) =>
      Effect.gen(function*() {
        const response = yield* Effect.tryPromise({
          try: () =>
            fetch(config.subgraphUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.studioApiKey}`
              },
              body: JSON.stringify({
                query,
                variables
              })
            }),
          catch: (error) =>
            new NetworkSubgraphError({
              message: `Failed to fetch from subgraph: ${error}`,
              query,
              variables
            })
        })

        if (!response.ok) {
          return yield* Effect.fail(
            new NetworkSubgraphError({
              message: `Subgraph request failed: ${response.status} ${response.statusText}`,
              query,
              variables
            })
          )
        }

        const data = yield* Effect.tryPromise({
          try: () => response.json() as Promise<{ data?: T; errors?: Array<{ message: string }> }>,
          catch: (error) =>
            new NetworkSubgraphError({
              message: `Failed to parse subgraph response: ${error}`,
              query,
              variables
            })
        })

        if (data.errors && data.errors.length > 0) {
          console.log(data.errors)
          console.log(query)
          return yield* Effect.fail(
            new NetworkSubgraphError({
              message: `GraphQL errors: ${data.errors.map((e) => e.message).join(", ")}`,
              query,
              variables
            })
          )
        }

        if (!data.data) {
          return yield* Effect.fail(
            new NetworkSubgraphError({
              message: "No data returned from subgraph",
              query,
              variables
            })
          )
        }

        return data.data
      })

    const getGraphNetwork = () =>
      Effect.gen(function*() {
        const queryData = yield* NetworkSubgraph.loadQuery("GraphNetwork")
        const rawResult = (yield* query(queryData)) as GraphNetworkSubgraphResponse
        if (!rawResult.graphNetworks) {
          throw new NetworkSubgraphError({
            message: "Graph network not found"
          })
        }
        return {
          maxThawingPeriod: BigInt(rawResult.graphNetworks[0].maxThawingPeriod)
        }
      })

    const getSubgraphService = () =>
      Effect.gen(function*() {
        const queryData = yield* NetworkSubgraph.loadQuery("SubgraphService")
        const rawResult = (yield* query(queryData)) as SubgraphServiceSubgraphResponse
        if (!rawResult.dataServices || !rawResult.graphNetworks) {
          throw new NetworkSubgraphError({
            message: "Subgraph service not found"
          })
        }
        return {
          minimumProvisionTokens: BigInt(rawResult.dataServices[0].minimumProvisionTokens),
          maximumProvisionTokens: BigInt(rawResult.dataServices[0].maximumProvisionTokens),
          minimumVerifierCut: BigInt(rawResult.graphNetworks[0].fishermanRewardCut),
          maximumVerifierCut: BigInt(rawResult.dataServices[0].maximumVerifierCut),
          minimumThawingPeriod: BigInt(rawResult.graphNetworks[0].disputePeriod),
          maximumThawingPeriod: BigInt(rawResult.graphNetworks[0].disputePeriod),
          maxPOIStaleness: BigInt(rawResult.dataServices[0].maxPOIStaleness),
          delegationRatio: BigInt(rawResult.dataServices[0].delegationRatio),
          stakeToFeesRatio: BigInt(rawResult.dataServices[0].stakeToFeesRatio),
          curationCut: BigInt(rawResult.dataServices[0].curationCut)
        }
      })

    const getDisputeManager = () =>
      Effect.gen(function*() {
        const queryData = yield* NetworkSubgraph.loadQuery("DisputeManager")
        const rawResult = (yield* query(queryData)) as DisputeManagerSubgraphResponse
        if (!rawResult.graphNetworks) {
          throw new NetworkSubgraphError({
            message: "Dispute manager not found"
          })
        }
        return {
          disputePeriod: BigInt(rawResult.graphNetworks[0].disputePeriod),
          fishermanRewardCut: BigInt(rawResult.graphNetworks[0].fishermanRewardCut),
          disputeDeposit: BigInt(rawResult.graphNetworks[0].minimumDisputeDeposit)
        }
      })

    const getIndexer = (address: string) =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const provider = new JsonRpcProvider(config.rpcUrl)
        const network = yield* Effect.tryPromise({
          try: () => provider.getNetwork(),
          catch: (error) =>
            new NetworkSubgraphError({
              message: `Failed to get network info: ${error}`
            })
        })
        const chainId = Number(network.chainId)
        const horizonContracts = yield* Effect.try({
          try: () => connectGraphHorizon(chainId, provider as any),
          catch: (error) =>
            new NetworkSubgraphError({
              message: `Failed to connect to Graph Horizon contracts: ${error}`
            })
        })
        const queryData = yield* NetworkSubgraph.loadQuery("Indexer")
        const rawResult = (yield* query(queryData, {
          id: address.toLowerCase(),
          collector: horizonContracts.GraphTallyCollector.target.toString().toLowerCase()
        })) as IndexerSubgraphResponse
        if (!rawResult.indexers) {
          throw new NetworkSubgraphError({
            message: "Indexer not found"
          })
        }

        const provisionExists = rawResult.provisions.length > 0
        const provisionTokensAllocated = provisionExists ? BigInt(rawResult.provisions[0].tokensAllocated) : BigInt(0)
        const provisionTokensThawing = provisionExists ? BigInt(rawResult.provisions[0].tokensThawing) : BigInt(0)
        const provisionTokensProvisioned = provisionExists
          ? BigInt(rawResult.provisions[0].tokensProvisioned)
          : BigInt(0)

        const legacyTokensAllocated = BigInt(rawResult.indexers[0].allocatedTokens) - provisionTokensAllocated
        const idleTokens = BigInt(rawResult.indexers[0].stakedTokens) -
          legacyTokensAllocated -
          BigInt(rawResult.indexers[0].lockedTokens) -
          BigInt(rawResult.indexers[0].provisionedTokens)
        return {
          id: rawResult.indexers[0].id,
          url: rawResult.indexers[0].url,
          geoHash: rawResult.indexers[0].geoHash,
          rewardsDestination: rawResult.indexers[0].rewardsDestination,
          stakedTokens: BigInt(rawResult.indexers[0].stakedTokens),
          delegatedTokens: BigInt(rawResult.indexers[0].delegatedTokens),
          delegatedThawingTokens: BigInt(0),
          totalProvisionedTokens: BigInt(rawResult.indexers[0].provisionedTokens),
          legacyTokensAllocated,
          tokensLocked: BigInt(rawResult.indexers[0].lockedTokens),
          idleTokens,
          availableTokens: BigInt(rawResult.indexers[0].tokenCapacity),
          allocatedTokens: provisionTokensAllocated,
          feesProvisionedTokens: BigInt(0),
          thawingTokens: provisionTokensThawing,
          provisionedTokens: provisionTokensProvisioned,
          tokensFree: BigInt(rawResult.indexers[0].availableStake),
          escrowAccountBalance: BigInt(rawResult.paymentsEscrowAccounts[0].balance),
          escrowAccountTokensThawing: BigInt(rawResult.paymentsEscrowAccounts[0].totalAmountThawing),
          escrowAccountThawEndTimestamp: BigInt(rawResult.paymentsEscrowAccounts[0].thawEndTimestamp)
        }
      })

    const getIndexerList = () =>
      Effect.gen(function*() {
        const queryData = yield* NetworkSubgraph.loadQuery("IndexerList")
        const rawResult = (yield* query(queryData)) as IndexerSubgraphResponse
        if (!rawResult.indexers) {
          throw new NetworkSubgraphError({
            message: "Indexer list not found"
          })
        }
        return rawResult
      })

    return NetworkSubgraph.of({
      getGraphNetwork,
      getSubgraphService,
      getDisputeManager,
      // @ts-ignore - TODO: Fix this
      getIndexer,
      getIndexerList
    })
  })
)
