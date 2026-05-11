import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import { ServiceProvider } from "../../generated/schema"
import { BIGINT_ZERO } from "../common/constants"

export class ServiceProviderResult {
  entity: ServiceProvider
  isNew: boolean

  constructor(entity: ServiceProvider, isNew: boolean) {
    this.entity = entity
    this.isNew = isNew
  }
}

export function getOrCreateServiceProvider(
  id: Bytes,
  blockNumber: BigInt,
  timestamp: BigInt
): ServiceProviderResult {
  let entity = ServiceProvider.load(id)
  let isNew = entity == null

  if (entity == null) {
    entity = new ServiceProvider(id)
    entity.tokensStaked = BIGINT_ZERO
    entity.tokensProvisioned = BIGINT_ZERO
    entity.tokensIdle = BIGINT_ZERO
    entity.createdAtBlock = blockNumber
    entity.createdAt = timestamp
    entity.updatedAtBlock = blockNumber
    entity.updatedAt = timestamp
  }

  return new ServiceProviderResult(entity, isNew)
}

export function updateServiceProviderOnStakeDeposit(
  serviceProvider: ServiceProvider,
  tokens: BigInt,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  serviceProvider.tokensStaked = serviceProvider.tokensStaked.plus(tokens)
  // TODO: Update tokensIdle when provision handlers are implemented
  // serviceProvider.tokensIdle = serviceProvider.tokensStaked.minus(serviceProvider.tokensProvisioned)
  serviceProvider.updatedAtBlock = blockNumber
  serviceProvider.updatedAt = timestamp
}

export function updateServiceProviderOnStakeWithdraw(
  serviceProvider: ServiceProvider,
  tokens: BigInt,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  assert(serviceProvider.tokensStaked >= tokens, "Withdraw exceeds staked tokens")

  serviceProvider.tokensStaked = serviceProvider.tokensStaked.minus(tokens)
  // TODO: Update tokensIdle when provision handlers are implemented
  // serviceProvider.tokensIdle = serviceProvider.tokensStaked.minus(serviceProvider.tokensProvisioned)
  serviceProvider.updatedAtBlock = blockNumber
  serviceProvider.updatedAt = timestamp
}
