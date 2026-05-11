import { Address } from "@graphprotocol/graph-ts"

export class NetworkConfig {
  network: string
  horizonStakingAddress: Address
  startBlock: i32
  serviceProviderAddresses: string[]

  constructor(
    network: string,
    horizonStakingAddress: Address,
    startBlock: i32,
    serviceProviderAddresses: string[]
  ) {
    this.network = network
    this.horizonStakingAddress = horizonStakingAddress
    this.startBlock = startBlock
    this.serviceProviderAddresses = serviceProviderAddresses
  }
}
