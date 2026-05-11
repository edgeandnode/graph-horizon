import {
  HorizonStakeDeposited,
  HorizonStakeWithdrawn
} from "../../generated/HorizonStaking/HorizonStaking"
import {
  getOrCreateGraphNetwork,
  updateGraphNetworkOnStakeDeposit,
  updateGraphNetworkOnStakeWithdraw
} from "../entities/graphNetwork"
import {
  getOrCreateServiceProvider,
  updateServiceProviderOnStakeDeposit,
  updateServiceProviderOnStakeWithdraw
} from "../entities/serviceProvider"

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

  // Service provider
  updateServiceProviderOnStakeDeposit(
    serviceProvider.entity,
    event.params.tokens,
    event.block.number,
    event.block.timestamp
  )
  serviceProvider.entity.save()

  // Graph network
  updateGraphNetworkOnStakeDeposit(graphNetwork, event.params.tokens, serviceProvider.isNew)
  graphNetwork.save()
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

  // Service provider
  updateServiceProviderOnStakeWithdraw(
    serviceProvider.entity,
    event.params.tokens,
    event.block.number,
    event.block.timestamp
  )
  serviceProvider.entity.save()

  // Graph network
  updateGraphNetworkOnStakeWithdraw(graphNetwork, event.params.tokens)
  graphNetwork.save()
}
