import { Address, Bytes, BigInt, crypto, ethereum } from "@graphprotocol/graph-ts"

// Function selectors (first 4 bytes of keccak256 of function signature)
// getStake(address) -> keccak256("getStake(address)")[0:4]
export const GET_STAKE_SELECTOR = Bytes.fromHexString("0x7a766460") as Bytes
// getDelegationPool(address,address) -> keccak256("getDelegationPool(address,address)")[0:4]
export const GET_DELEGATION_POOL_SELECTOR = Bytes.fromHexString("0x561285e4") as Bytes
// getDelegation(address,address,address) -> keccak256("getDelegation(address,address,address)")[0:4]
export const GET_DELEGATION_SELECTOR = Bytes.fromHexString("0x15049a5a") as Bytes

/**
 * Encodes a getStake(address) call
 */
export function encodeGetStake(serviceProvider: Address): Bytes {
  let encoded = ethereum.encode(ethereum.Value.fromAddress(serviceProvider))!
  return GET_STAKE_SELECTOR.concat(encoded)
}

/**
 * Encodes a getDelegationPool(address,address) call
 */
export function encodeGetDelegationPool(serviceProvider: Address, verifier: Address): Bytes {
  let tuple = new ethereum.Tuple()
  tuple.push(ethereum.Value.fromAddress(serviceProvider))
  tuple.push(ethereum.Value.fromAddress(verifier))
  let encoded = ethereum.encode(ethereum.Value.fromTuple(tuple))!
  return GET_DELEGATION_POOL_SELECTOR.concat(encoded)
}

/**
 * Encodes a getDelegation(address,address,address) call
 */
export function encodeGetDelegation(
  serviceProvider: Address,
  verifier: Address,
  delegator: Address
): Bytes {
  let tuple = new ethereum.Tuple()
  tuple.push(ethereum.Value.fromAddress(serviceProvider))
  tuple.push(ethereum.Value.fromAddress(verifier))
  tuple.push(ethereum.Value.fromAddress(delegator))
  let encoded = ethereum.encode(ethereum.Value.fromTuple(tuple))!
  return GET_DELEGATION_SELECTOR.concat(encoded)
}

/**
 * Decodes a getStake result (uint256)
 */
export function decodeGetStakeResult(data: Bytes): BigInt {
  let decoded = ethereum.decode("(uint256)", data)
  if (decoded == null) {
    return BigInt.zero()
  }
  return decoded.toTuple()[0].toBigInt()
}

/**
 * Decodes a getDelegationPool result (uint256,uint256,uint256,uint256,uint256)
 * Returns: [tokens, shares, tokensThawing, sharesThawing, thawingNonce]
 */
export function decodeGetDelegationPoolResult(data: Bytes): BigInt[] {
  let decoded = ethereum.decode("(uint256,uint256,uint256,uint256,uint256)", data)
  if (decoded == null) {
    return [BigInt.zero(), BigInt.zero(), BigInt.zero(), BigInt.zero(), BigInt.zero()]
  }
  let tuple = decoded.toTuple()
  return [
    tuple[0].toBigInt(),
    tuple[1].toBigInt(),
    tuple[2].toBigInt(),
    tuple[3].toBigInt(),
    tuple[4].toBigInt(),
  ]
}

/**
 * Decodes a getDelegation result (uint256) - just shares
 */
export function decodeGetDelegationResult(data: Bytes): BigInt {
  let decoded = ethereum.decode("(uint256)", data)
  if (decoded == null) {
    return BigInt.zero()
  }
  return decoded.toTuple()[0].toBigInt()
}
