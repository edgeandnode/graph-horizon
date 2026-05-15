import { Address, Bytes, crypto, ethereum, BigInt, log } from "@graphprotocol/graph-ts"
import {
  AllocationClosed,
  RebateCollected,
} from "../../generated/HorizonStaking/HorizonStaking"
import { getOrCreateGraphNetwork, saveGraphNetwork } from "../entities/graphNetwork"
import { getOrCreateServiceProvider, saveServiceProvider } from "../entities/serviceProvider"
import { getOrCreateDelegationPool, saveDelegationPool } from "../entities/delegationPool"
import { config } from "../config"

// Event signature for HorizonRewardsAssigned(address indexed indexer, address indexed allocationID, uint256 amount)
// keccak256("HorizonRewardsAssigned(address,address,uint256)")
const HORIZON_REWARDS_ASSIGNED_TOPIC = Bytes.fromHexString(
  "0xa111914d7f2ea8beca61d12f1a1f38c5533de5f1823c3936422df4404ac2ec68"
)

const PPM_DIVISOR = BigInt.fromI32(1000000)

/**
 * Handles RebateCollected event from HorizonStakingExtension.
 * This event is emitted when query fee rebates are collected.
 * The delegationRewards parameter represents tokens added to the legacy delegation pool
 * that are NOT emitted via TokensToDelegationPoolAdded because they correspond to
 * legacy allocations.
 */
export function handleRebateCollected(event: RebateCollected): void {
  let indexer = event.params.indexer
  let delegationRewards = event.params.delegationRewards

  // Skip if no delegation rewards
  if (delegationRewards.equals(BigInt.zero())) {
    return
  }

  let indexerBytes = Bytes.fromHexString(indexer.toHexString()) as Bytes
  let verifier = Bytes.fromHexString(config.subgraphServiceAddress.toHexString()) as Bytes

  // Update legacy DelegationPool
  let pool = getOrCreateDelegationPool(
    indexerBytes,
    verifier,
    event.block.number,
    event.block.timestamp
  )
  assert(!pool.isNew, "Delegation pool does not exist.")
  pool.entity.tokens = pool.entity.tokens.plus(delegationRewards)
  saveDelegationPool(pool.entity, event.block)

  // Update ServiceProvider
  let serviceProvider = getOrCreateServiceProvider(indexerBytes, event.block.number, event.block.timestamp)
  assert(!serviceProvider.isNew, "Service provider does not exist.")
  serviceProvider.entity.tokensDelegated = serviceProvider.entity.tokensDelegated.plus(delegationRewards)
  saveServiceProvider(serviceProvider.entity, event.block)

  // Update GraphNetwork
  let graphNetwork = getOrCreateGraphNetwork()
  graphNetwork.tokensDelegated = graphNetwork.tokensDelegated.plus(delegationRewards)
  saveGraphNetwork(graphNetwork)
}

/**
 * Handles AllocationClosed event from HorizonStakingExtension.
 * When an allocation is closed with a proof of indexing, indexing rewards are distributed.
 * Part of these rewards go to the legacy delegation pool via _collectDelegationIndexingRewards(),
 * but NO event is emitted for this. We need to look for the associated HorizonRewardsAssigned
 * event in the transaction receipt and calculate the delegation rewards ourselves.
 */
export function handleAllocationClosed(event: AllocationClosed): void {
  let receipt = event.receipt
  if (receipt == null) {
    log.critical("Could not find receipt for legacy allocation: {}.", [event.params.allocationID.toHexString()])
    return
  }

  let indexer = event.params.indexer
  let allocationID = event.params.allocationID
  let indexerBytes = Bytes.fromHexString(indexer.toHexString()) as Bytes

  // Look for HorizonRewardsAssigned event in the same transaction
  let totalRewards = BigInt.zero()
  let foundRewardsEvent = false

  for (let i = 0; i < receipt.logs.length; i++) {
    let log = receipt.logs[i]

    // Check if this is a HorizonRewardsAssigned event
    if (log.topics.length >= 3 && log.topics[0].equals(HORIZON_REWARDS_ASSIGNED_TOPIC)) {
      // topic[1] = indexed indexer address (padded to 32 bytes)
      // topic[2] = indexed allocationID address (padded to 32 bytes)
      // data = uint256 amount

      // Extract allocationID from topic[2] (last 20 bytes of the 32-byte topic)
      let logAllocationID = Address.fromBytes(Bytes.fromUint8Array(log.topics[2].slice(12, 32)))

      // Check if this event is for our allocation
      if (logAllocationID.equals(allocationID)) {
        // Decode the rewards amount from data
        if (log.data.length >= 32) {
          totalRewards = ethereum.decode("uint256", log.data)!.toBigInt()
          foundRewardsEvent = true
          break
        }
      }
    }
  }

  // Crash if not found
  assert(foundRewardsEvent && totalRewards.notEqual(BigInt.zero()), "Could not found rewards event for allocation.")

  let verifier = Bytes.fromHexString(config.subgraphServiceAddress.toHexString()) as Bytes

  // Get the legacy DelegationPool to read the indexer's reward cut
  let pool = getOrCreateDelegationPool(
    indexerBytes,
    verifier,
    event.block.number,
    event.block.timestamp
  )
  assert(!pool.isNew, "Delegation pool does not exist.")

  // Calculate delegation rewards using the indexer's configured cut
  // delegationRewards = totalRewards - (totalRewards * indexerCut / PPM)
  let indexerCut = BigInt.fromI32(pool.entity.legacyIndexingRewardCut)
  let indexerRewards = totalRewards.times(indexerCut).div(PPM_DIVISOR)
  let delegationRewards = totalRewards.minus(indexerRewards)

  // Skip if no delegation rewards
  if (delegationRewards.equals(BigInt.zero())) {
    return
  }

  // Update pool tokens
  pool.entity.tokens = pool.entity.tokens.plus(delegationRewards)
  saveDelegationPool(pool.entity, event.block)

  // Update ServiceProvider
  let serviceProvider = getOrCreateServiceProvider(indexerBytes, event.block.number, event.block.timestamp)
  assert(!serviceProvider.isNew, "Service provider does not exist.")
  serviceProvider.entity.tokensDelegated = serviceProvider.entity.tokensDelegated.plus(delegationRewards)
  saveServiceProvider(serviceProvider.entity, event.block)

  // Update GraphNetwork
  let graphNetwork = getOrCreateGraphNetwork()
  graphNetwork.tokensDelegated = graphNetwork.tokensDelegated.plus(delegationRewards)
  saveGraphNetwork(graphNetwork)
}

