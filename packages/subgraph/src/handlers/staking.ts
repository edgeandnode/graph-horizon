import {
  HorizonStakeDeposited,
  HorizonStakeWithdrawn
} from "../../generated/HorizonStaking/HorizonStaking"
import { BIGINT_ZERO } from "../common/constants"
import { getOrCreateGraphNetwork, saveGraphNetwork } from "../entities/graphNetwork"
import { getOrCreateServiceProvider, saveServiceProvider } from "../entities/serviceProvider"

/**
 * Emitted by:
 * - stake(), stakeTo(), or stakeToProvision() direct calls
 * - Horizon indexing rewards when paymentsDestination == address(0) (calls stakeToProvision() internally)
 * - Horizon query fees when receiverDestination == address(0) (GraphPayments.collect() calls stakeTo() internally)
 * - Legacy allocation close when rewardsDestination == address(0) (calls _stake() internally)
 * - Legacy query fees collect when rewardsDestination == address(0) (calls _stake() internally)
 */
export function handleHorizonStakeDeposited(event: HorizonStakeDeposited): void {
  let graphNetwork = getOrCreateGraphNetwork()
  let serviceProvider = getOrCreateServiceProvider(
    event.params.serviceProvider,
    event.block.number,
    event.block.timestamp
  )

  // ServiceProvider
  serviceProvider.entity.tokensStaked = serviceProvider.entity.tokensStaked.plus(event.params.tokens)
  assert(serviceProvider.entity.tokensStaked >= serviceProvider.entity.tokensProvisioned, "Provisioned tokens exceed staked tokens.")
  serviceProvider.entity.tokensIdle = serviceProvider.entity.tokensStaked.minus(serviceProvider.entity.tokensProvisioned)
  saveServiceProvider(serviceProvider.entity, event.block)

  // GraphNetwork
  graphNetwork.tokensStaked = graphNetwork.tokensStaked.plus(event.params.tokens)
  if (serviceProvider.isNew) {
    graphNetwork.countServiceProviders += 1
  }
  saveGraphNetwork(graphNetwork)
}

/**
 * Emitted by:
 * - unstake() after Horizon transition period
 * - withdraw() after thawing period has expired (only for unstake thawings initiated before Horizon)
 */
export function handleHorizonStakeWithdrawn(event: HorizonStakeWithdrawn): void {
  let graphNetwork = getOrCreateGraphNetwork()
  let serviceProvider = getOrCreateServiceProvider(
    event.params.serviceProvider,
    event.block.number,
    event.block.timestamp
  )

  // ServiceProvider
  assert(!serviceProvider.isNew, "Service provider does not exist.")
  assert(serviceProvider.entity.tokensStaked >= event.params.tokens, "Withdraw exceeds staked tokens.")
  serviceProvider.entity.tokensStaked = serviceProvider.entity.tokensStaked.minus(event.params.tokens)
  assert(serviceProvider.entity.tokensStaked >= serviceProvider.entity.tokensProvisioned, "Provisioned tokens exceed staked tokens.")
  serviceProvider.entity.tokensIdle = serviceProvider.entity.tokensStaked.minus(serviceProvider.entity.tokensProvisioned)
  saveServiceProvider(serviceProvider.entity, event.block)

  // GraphNetwork
  assert(graphNetwork.tokensStaked >= event.params.tokens, "Withdraw exceeds total staked.")
  graphNetwork.tokensStaked = graphNetwork.tokensStaked.minus(event.params.tokens)
  // Decrement counter if SP becomes inactive (no stake)
  if (serviceProvider.entity.tokensStaked.equals(BIGINT_ZERO)) {
    assert(graphNetwork.countServiceProviders > 0, "Service provider count is zero.")
    graphNetwork.countServiceProviders -= 1
  }
  saveGraphNetwork(graphNetwork)
}
