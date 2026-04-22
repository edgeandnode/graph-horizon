import type { Effect } from "effect"
import type { NetworkServiceError } from "./NetworkService.js"
import type { DisputeManager } from "./schemas/DisputeManager.js"
import type { GraphNetwork } from "./schemas/GraphNetwork.js"
import type { Indexer } from "./schemas/Indexer.js"
import type { SubgraphService } from "./schemas/SubgraphService.js"

/**
 * Network data can be fetched from multiple sources. This abstract class is used to define the interface for these sources.
 * Available sources are:
 * - RPC calls to Graph Horizon contracts
 * - Graph NetworkSubgraph
 */
export abstract class NetworkDataSource {
  abstract getGraphNetwork(): Effect.Effect<GraphNetwork, NetworkServiceError>
  abstract getSubgraphService(): Effect.Effect<SubgraphService, NetworkServiceError>
  abstract getDisputeManager(): Effect.Effect<DisputeManager, NetworkServiceError>
  abstract getIndexer(address: string): Effect.Effect<Indexer, NetworkServiceError>
}
