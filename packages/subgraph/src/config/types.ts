import { Address } from "@graphprotocol/graph-ts"

export class NetworkConfig {
  network: string
  horizonStakingAddress: Address
  subgraphServiceAddress: Address
  startBlock: i32
  serviceProviderAddresses: string[]
  delegatedIndexerAddresses: string[]

  constructor(
    network: string,
    horizonStakingAddress: Address,
    subgraphServiceAddress: Address,
    startBlock: i32,
    serviceProviderAddresses: string[],
    delegatedIndexerAddresses: string[]
  ) {
    this.network = network
    this.horizonStakingAddress = horizonStakingAddress
    this.subgraphServiceAddress = subgraphServiceAddress
    this.startBlock = startBlock
    this.serviceProviderAddresses = serviceProviderAddresses
    this.delegatedIndexerAddresses = delegatedIndexerAddresses
  }
}
