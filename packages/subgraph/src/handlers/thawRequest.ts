import { Bytes, log } from "@graphprotocol/graph-ts"
import {
  ThawRequestCreated,
  ThawRequestFulfilled,
} from "../../generated/HorizonStaking/HorizonStaking"
import { ProvisionThawRequest } from "../../generated/schema"
import {
  getOrCreateProvisionThawRequest,
  saveProvisionThawRequest,
} from "../entities/provisionThawRequest"

// ThawRequestType enum values from the contract
// 0 = Provision
// 1 = Delegation
const THAW_REQUEST_TYPE_PROVISION = 0

/**
 * Handles ThawRequestCreated event.
 * Creates a ProvisionThawRequest entity when a service provider initiates thawing.
 * Only handles provision thaw requests (type 0), ignores delegation thaw requests.
 */
export function handleThawRequestCreated(event: ThawRequestCreated): void {
  if (event.params.requestType != THAW_REQUEST_TYPE_PROVISION) {
    return
  }

  let serviceProviderBytes = Bytes.fromHexString(
    event.params.serviceProvider.toHexString()
  ) as Bytes
  let dataServiceBytes = Bytes.fromHexString(
    event.params.verifier.toHexString()
  ) as Bytes

  let thawRequest = getOrCreateProvisionThawRequest(
    event.params.thawRequestId,
    serviceProviderBytes,
    dataServiceBytes,
    event.block.number,
    event.block.timestamp
  )

  assert(thawRequest.isNew, "Thaw request already exists.")
  thawRequest.entity.shares = event.params.shares
  thawRequest.entity.thawingUntil = event.params.thawingUntil
  thawRequest.entity.thawingNonce = event.params.nonce

  saveProvisionThawRequest(thawRequest.entity, event.block)
}

/**
 * Handles ThawRequestFulfilled event.
 * Updates a ProvisionThawRequest entity when thawed tokens are withdrawn.
 * Only handles provision thaw requests (type 0), ignores delegation thaw requests.
 */
export function handleThawRequestFulfilled(event: ThawRequestFulfilled): void {
  if (event.params.requestType != THAW_REQUEST_TYPE_PROVISION) {
    return
  }

  // Load directly since ThawRequestFulfilled doesn't include serviceProvider/dataService
  let thawRequest = ProvisionThawRequest.load(event.params.thawRequestId)
  if (thawRequest == null) {
    log.critical("Could not find thaw request: {}.", [event.params.thawRequestId.toHexString()])
    return
  }

  thawRequest.tokensWithdrawn = event.params.tokens
  thawRequest.valid = event.params.valid
  thawRequest.fulfilled = true

  saveProvisionThawRequest(thawRequest, event.block)
}
