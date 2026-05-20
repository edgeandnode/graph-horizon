import { Bytes } from "@graphprotocol/graph-ts"
import { DelegationFeeCutSet } from "../../generated/HorizonStaking/HorizonStaking"
import {
  getOrCreateProvisionFeeCut,
  saveProvisionFeeCut,
} from "../entities/provisionFeeCut"

/**
 * Handles DelegationFeeCutSet event.
 * Creates or updates a ProvisionFeeCut entity when a service provider sets
 * their fee cut percentage for a specific payment type on a provision.
 */
export function handleDelegationFeeCutSet(event: DelegationFeeCutSet): void {
  let serviceProviderBytes = Bytes.fromHexString(
    event.params.serviceProvider.toHexString()
  ) as Bytes
  let dataServiceBytes = Bytes.fromHexString(
    event.params.verifier.toHexString()
  ) as Bytes

  let feeCut = getOrCreateProvisionFeeCut(
    serviceProviderBytes,
    dataServiceBytes,
    event.params.paymentType,
    event.block.number,
    event.block.timestamp
  )

  feeCut.entity.feeCut = event.params.feeCut

  saveProvisionFeeCut(feeCut.entity, event.block)
}
