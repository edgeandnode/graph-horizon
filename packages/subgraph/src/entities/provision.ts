import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import { Provision } from "../../generated/schema"
import { BIGINT_ZERO } from "../common/constants"

export function getProvisionId(serviceProvider: Bytes, verifier: Bytes): Bytes {
  return serviceProvider.concat(verifier)
}

export class ProvisionResult {
  entity: Provision
  isNew: boolean

  constructor(entity: Provision, isNew: boolean) {
    this.entity = entity
    this.isNew = isNew
  }
}

export function getOrCreateProvision(
  serviceProvider: Bytes,
  verifier: Bytes,
  blockNumber: BigInt,
  timestamp: BigInt
): ProvisionResult {
  let id = getProvisionId(serviceProvider, verifier)
  let entity = Provision.load(id)
  let isNew = entity == null

  if (entity == null) {
    entity = new Provision(id)
    entity.serviceProvider = serviceProvider
    entity.verifier = verifier
    entity.tokens = BIGINT_ZERO
    entity.tokensThawing = BIGINT_ZERO
    entity.maxVerifierCut = BIGINT_ZERO
    entity.thawingPeriod = BIGINT_ZERO
    entity.maxVerifierCutPending = BIGINT_ZERO
    entity.thawingPeriodPending = BIGINT_ZERO
    entity.lastParametersStagedAt = BIGINT_ZERO
    entity.createdAtBlock = blockNumber
    entity.createdAt = timestamp
    entity.updatedAtBlock = blockNumber
    entity.updatedAt = timestamp
  }

  return new ProvisionResult(entity, isNew)
}

export function updateProvisionOnCreated(
  provision: Provision,
  tokens: BigInt,
  maxVerifierCut: BigInt,
  thawingPeriod: BigInt,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  provision.tokens = tokens
  provision.maxVerifierCut = maxVerifierCut
  provision.thawingPeriod = thawingPeriod
  provision.updatedAtBlock = blockNumber
  provision.updatedAt = timestamp
}

export function updateProvisionOnIncreased(
  provision: Provision,
  tokens: BigInt,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  provision.tokens = provision.tokens.plus(tokens)
  provision.updatedAtBlock = blockNumber
  provision.updatedAt = timestamp
}

export function updateProvisionOnThawed(
  provision: Provision,
  tokens: BigInt,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  provision.tokens = provision.tokens.minus(tokens)
  provision.tokensThawing = provision.tokensThawing.plus(tokens)
  provision.updatedAtBlock = blockNumber
  provision.updatedAt = timestamp
}

export function updateProvisionOnSlashed(
  provision: Provision,
  tokens: BigInt,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  provision.tokens = provision.tokens.minus(tokens)
  provision.updatedAtBlock = blockNumber
  provision.updatedAt = timestamp
}

export function updateProvisionOnParametersStaged(
  provision: Provision,
  maxVerifierCut: BigInt,
  thawingPeriod: BigInt,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  provision.maxVerifierCutPending = maxVerifierCut
  provision.thawingPeriodPending = thawingPeriod
  provision.lastParametersStagedAt = timestamp
  provision.updatedAtBlock = blockNumber
  provision.updatedAt = timestamp
}

export function updateProvisionOnParametersSet(
  provision: Provision,
  maxVerifierCut: BigInt,
  thawingPeriod: BigInt,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  provision.maxVerifierCut = maxVerifierCut
  provision.thawingPeriod = thawingPeriod
  provision.maxVerifierCutPending = BIGINT_ZERO
  provision.thawingPeriodPending = BIGINT_ZERO
  provision.updatedAtBlock = blockNumber
  provision.updatedAt = timestamp
}
