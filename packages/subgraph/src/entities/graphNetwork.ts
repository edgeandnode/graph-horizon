import { GraphNetwork } from "../../generated/schema"
import { BIGINT_ZERO, GRAPH_NETWORK_ID } from "../common/constants"

export function getOrCreateGraphNetwork(): GraphNetwork {
  let entity = GraphNetwork.load(GRAPH_NETWORK_ID)
  if (entity == null) {
    entity = new GraphNetwork(GRAPH_NETWORK_ID)

    // Counts
    entity.countServiceProviders = 0
    entity.countProvisions = 0
    entity.countDelegationPools = 0
    entity.countProvisionSlashEvents = 0
    entity.countDelegationPoolSlashEvents = 0

    // Stake aggregates
    entity.tokensStaked = BIGINT_ZERO
    entity.tokensProvisioned = BIGINT_ZERO
    entity.tokensDelegated = BIGINT_ZERO
    entity.tokensThawingFromProvisions = BIGINT_ZERO
    entity.tokensThawingFromDelegationPools = BIGINT_ZERO

    // Slashing aggregates
    entity.tokensSlashed = BIGINT_ZERO
    entity.tokensSlashedFromProvisions = BIGINT_ZERO
    entity.tokensSlashedFromDelegationPools = BIGINT_ZERO
  }
  return entity
}

export function saveGraphNetwork(graphNetwork: GraphNetwork): void {
  graphNetwork.save()
}
