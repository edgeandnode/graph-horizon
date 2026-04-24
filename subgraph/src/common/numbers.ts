import { BigInt, BigDecimal } from "@graphprotocol/graph-ts"
import { BIGDECIMAL_ZERO } from "./constants"

export function bigIntToBigDecimal(value: BigInt, decimals: i32 = 18): BigDecimal {
  return value.toBigDecimal().div(
    BigInt.fromI32(10).pow(decimals as u8).toBigDecimal()
  )
}

export function safeDiv(a: BigDecimal, b: BigDecimal): BigDecimal {
  if (b.equals(BIGDECIMAL_ZERO)) {
    return BIGDECIMAL_ZERO
  }
  return a.div(b)
}
