import { GraphNetwork } from "../../generated/schema"
import { BIGINT_ZERO, GRAPH_NETWORK_ID } from "../common/constants"

export function getOrCreateGraphNetwork(): GraphNetwork {
  let entity = GraphNetwork.load(GRAPH_NETWORK_ID)
  if (entity == null) {
    entity = new GraphNetwork(GRAPH_NETWORK_ID)
    entity.countServiceProviders = 0
    entity.countProvisions = 0
    entity.countDelegationPools = 0
    entity.countDelegators = 0
    entity.tokensStaked = BIGINT_ZERO
    entity.tokensProvisioned = BIGINT_ZERO
    entity.tokensDelegated = BIGINT_ZERO
  }
  return entity
}

export function saveGraphNetwork(graphNetwork: GraphNetwork): void {
  graphNetwork.save()
}
