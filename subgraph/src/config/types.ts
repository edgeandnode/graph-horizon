import { Address } from "@graphprotocol/graph-ts"

export class NetworkConfig {
  network: string
  horizonStakingAddress: Address
  startBlock: i32

  constructor(network: string, horizonStakingAddress: Address, startBlock: i32) {
    this.network = network
    this.horizonStakingAddress = horizonStakingAddress
    this.startBlock = startBlock
  }
}
