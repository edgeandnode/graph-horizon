import { BigInt } from "@graphprotocol/graph-ts"
import { GraphNetwork } from "../../generated/schema"
import { BIGINT_ZERO, GRAPH_NETWORK_ID } from "../common/constants"

export function getOrCreateGraphNetwork(): GraphNetwork {
  let entity = GraphNetwork.load(GRAPH_NETWORK_ID)
  if (entity == null) {
    entity = new GraphNetwork(GRAPH_NETWORK_ID)
    entity.countServiceProviders = 0
    entity.countProvisions = 0
    entity.tokensStaked = BIGINT_ZERO
    entity.tokensProvisioned = BIGINT_ZERO
  }
  return entity
}

export function updateGraphNetworkOnStakeDeposit(
  graphNetwork: GraphNetwork,
  tokens: BigInt,
  isNewServiceProvider: boolean
): void {
  graphNetwork.tokensStaked = graphNetwork.tokensStaked.plus(tokens)
  if (isNewServiceProvider) {
    graphNetwork.countServiceProviders += 1
  }
}

export function updateGraphNetworkOnStakeWithdraw(
  graphNetwork: GraphNetwork,
  tokens: BigInt
): void {
  assert(graphNetwork.tokensStaked >= tokens, "Withdraw exceeds total staked")

  graphNetwork.tokensStaked = graphNetwork.tokensStaked.minus(tokens)
}

export function updateGraphNetworkOnProvisionCreated(
  graphNetwork: GraphNetwork,
  tokens: BigInt
): void {
  graphNetwork.countProvisions += 1
  graphNetwork.tokensProvisioned = graphNetwork.tokensProvisioned.plus(tokens)
}

export function updateGraphNetworkOnProvisionIncreased(
  graphNetwork: GraphNetwork,
  tokens: BigInt
): void {
  graphNetwork.tokensProvisioned = graphNetwork.tokensProvisioned.plus(tokens)
}

export function updateGraphNetworkOnProvisionThawed(
  graphNetwork: GraphNetwork,
  tokens: BigInt
): void {
  graphNetwork.tokensProvisioned = graphNetwork.tokensProvisioned.minus(tokens)
}

export function updateGraphNetworkOnProvisionSlashed(
  graphNetwork: GraphNetwork,
  tokens: BigInt
): void {
  graphNetwork.tokensProvisioned = graphNetwork.tokensProvisioned.minus(tokens)
  graphNetwork.tokensStaked = graphNetwork.tokensStaked.minus(tokens)
}
