import { Address } from "@graphprotocol/graph-ts"

export class NetworkConfig {
  network: string
  horizonStakingAddress: Address
  subgraphServiceAddress: Address
  startBlock: i32
  // List of existing service providers with stake > 0 at Horizon genesis
  // Used to trigger state migration
  serviceProviderAddresses: string[]
  // List of existing delegation pools with tokens > 0 at Horizon genesis
  // Used to trigger state migration
  delegatedIndexerAddresses: string[]
  // Legacy indexer reward cuts in PPM (parts per million)
  // Parallel array with delegatedIndexerAddresses - same index = same indexer
  // Used to calculate delegation rewards from legacy indexing rewards
  legacyIndexerRewardCuts: i32[]

  constructor(
    network: string,
    horizonStakingAddress: Address,
    subgraphServiceAddress: Address,
    startBlock: i32,
    serviceProviderAddresses: string[],
    delegatedIndexerAddresses: string[],
    legacyIndexerRewardCuts: i32[]
  ) {
    this.network = network
    this.horizonStakingAddress = horizonStakingAddress
    this.subgraphServiceAddress = subgraphServiceAddress
    this.startBlock = startBlock
    this.serviceProviderAddresses = serviceProviderAddresses
    this.delegatedIndexerAddresses = delegatedIndexerAddresses
    this.legacyIndexerRewardCuts = legacyIndexerRewardCuts
  }
}
