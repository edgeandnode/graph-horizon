import { Bytes } from "@graphprotocol/graph-ts"

export function twoPartId(a: Bytes, b: Bytes): Bytes {
  return a.concat(b)
}

export function threePartId(a: Bytes, b: Bytes, c: Bytes): Bytes {
  return a.concat(b).concat(c)
}
