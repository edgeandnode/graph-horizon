import { Bytes } from "@graphprotocol/graph-ts"
import { OperatorSet } from "../../generated/HorizonStaking/HorizonStaking"
import { getOrCreateOperator, saveOperator } from "../entities/operator"
import {
  getOrCreateOperatorAuthorization,
  saveOperatorAuthorization,
} from "../entities/operatorAuthorization"

/**
 * Handles OperatorSet event.
 * Creates or updates Operator and OperatorAuthorization entities when a service provider
 * authorizes or revokes an operator for a specific data service.
 */
export function handleOperatorSet(event: OperatorSet): void {
  let operatorBytes = Bytes.fromHexString(event.params.operator.toHexString()) as Bytes
  let serviceProviderBytes = Bytes.fromHexString(event.params.serviceProvider.toHexString()) as Bytes
  let dataServiceBytes = Bytes.fromHexString(event.params.verifier.toHexString()) as Bytes

  let operator = getOrCreateOperator(operatorBytes, event.block.number, event.block.timestamp)
  let authorization = getOrCreateOperatorAuthorization(
    operatorBytes,
    serviceProviderBytes,
    dataServiceBytes,
    event.block.number,
    event.block.timestamp
  )

  // Track authorization count changes on Operator
  let wasAllowed = authorization.entity.allowed
  let isAllowed = event.params.allowed

  if (!wasAllowed && isAllowed) {
    operator.entity.countAuthorizations += 1
  } else if (wasAllowed && !isAllowed) {
    operator.entity.countAuthorizations -= 1
  }

  authorization.entity.allowed = isAllowed

  saveOperator(operator.entity, event.block)
  saveOperatorAuthorization(authorization.entity, event.block)
}
