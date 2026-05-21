import { Bytes } from "@graphprotocol/graph-ts"
import {
  Deposit,
  Thaw,
  CancelThaw,
  Withdraw,
  EscrowCollected,
} from "../../generated/PaymentsEscrow/PaymentsEscrow"
import { getOrCreateGraphNetwork, saveGraphNetwork } from "../entities/graphNetwork"
import { getOrCreateServiceProvider, saveServiceProvider } from "../entities/serviceProvider"
import { getOrCreatePayer, savePayer } from "../entities/payer"
import { getOrCreateCollector, saveCollector } from "../entities/collector"
import { getOrCreateEscrowAccount, saveEscrowAccount } from "../entities/escrowAccount"
import { BIGINT_ZERO } from "../common/constants"

/**
 * Handles Deposit event from PaymentsEscrow.
 * Creates/updates Payer, Collector, EscrowAccount entities.
 */
export function handleDeposit(event: Deposit): void {
  let payerAddress = Bytes.fromHexString(event.params.payer.toHexString()) as Bytes
  let collectorAddress = Bytes.fromHexString(event.params.collector.toHexString()) as Bytes
  let receiverAddress = Bytes.fromHexString(event.params.receiver.toHexString()) as Bytes
  let tokens = event.params.tokens

  let graphNetwork = getOrCreateGraphNetwork()

  // payer
  let payer = getOrCreatePayer(payerAddress, event.block.number, event.block.timestamp)
  if (payer.isNew) {
    graphNetwork.countPayers += 1
  }
  payer.entity.tokensEscrowed = payer.entity.tokensEscrowed.plus(tokens)
  savePayer(payer.entity, event.block)

  // collector
  let collector = getOrCreateCollector(collectorAddress, event.block.number, event.block.timestamp)
  if (collector.isNew) {
    graphNetwork.countCollectors += 1
  }
  collector.entity.tokensEscrowed = collector.entity.tokensEscrowed.plus(tokens)
  saveCollector(collector.entity, event.block)

  // service provider
  let serviceProvider = getOrCreateServiceProvider(receiverAddress, event.block.number, event.block.timestamp)
  if (serviceProvider.isNew) {
    graphNetwork.countServiceProviders += 1
  }
  serviceProvider.entity.tokensEscrowed = serviceProvider.entity.tokensEscrowed.plus(tokens)
  saveServiceProvider(serviceProvider.entity, event.block)

  // escrow account
  let escrowAccount = getOrCreateEscrowAccount(
    payerAddress,
    collectorAddress,
    receiverAddress,
    event.block.number,
    event.block.timestamp
  )
  if (escrowAccount.isNew) {
    graphNetwork.countEscrowAccounts += 1
    payer.entity.countEscrowAccounts += 1
    collector.entity.countEscrowAccounts += 1
    serviceProvider.entity.countEscrowAccounts += 1
    savePayer(payer.entity, event.block)
    saveCollector(collector.entity, event.block)
    saveServiceProvider(serviceProvider.entity, event.block)
  }
  escrowAccount.entity.tokens = escrowAccount.entity.tokens.plus(tokens)
  saveEscrowAccount(escrowAccount.entity, event.block)

  // GraphNetwork
  graphNetwork.tokensEscrowed = graphNetwork.tokensEscrowed.plus(tokens)
  saveGraphNetwork(graphNetwork)
}

/**
 * Handles Thaw event from PaymentsEscrow.
 * Moves tokens from available to thawing state.
 */
export function handleThaw(event: Thaw): void {
  let payerAddress = Bytes.fromHexString(event.params.payer.toHexString()) as Bytes
  let collectorAddress = Bytes.fromHexString(event.params.collector.toHexString()) as Bytes
  let receiverAddress = Bytes.fromHexString(event.params.receiver.toHexString()) as Bytes
  let tokens = event.params.tokens
  let thawEndTimestamp = event.params.thawEndTimestamp

  let graphNetwork = getOrCreateGraphNetwork()

  let payer = getOrCreatePayer(payerAddress, event.block.number, event.block.timestamp)
  assert(!payer.isNew, "Payer does not exist.")

  let collector = getOrCreateCollector(collectorAddress, event.block.number, event.block.timestamp)
  assert(!collector.isNew, "Collector does not exist.")

  let escrowAccount = getOrCreateEscrowAccount(
    payerAddress,
    collectorAddress,
    receiverAddress,
    event.block.number,
    event.block.timestamp
  )
  assert(!escrowAccount.isNew, "Escrow account does not exist.")

  // escrow account
  assert(escrowAccount.entity.tokens >= tokens, "Thaw tokens greater than escrow account tokens.")
  escrowAccount.entity.tokens = escrowAccount.entity.tokens.minus(tokens)
  escrowAccount.entity.tokensThawing = escrowAccount.entity.tokensThawing.plus(tokens)
  escrowAccount.entity.thawEndTimestamp = thawEndTimestamp
  saveEscrowAccount(escrowAccount.entity, event.block)

  // payer
  payer.entity.tokensThawing = payer.entity.tokensThawing.plus(tokens)
  savePayer(payer.entity, event.block)

  // collector
  collector.entity.tokensThawing = collector.entity.tokensThawing.plus(tokens)
  saveCollector(collector.entity, event.block)

  // GraphNetwork
  graphNetwork.tokensThawingFromEscrow = graphNetwork.tokensThawingFromEscrow.plus(tokens)
  saveGraphNetwork(graphNetwork)
}

/**
 * Handles CancelThaw event from PaymentsEscrow.
 * Moves tokens back from thawing to available state.
 */
export function handleCancelThaw(event: CancelThaw): void {
  let payerAddress = Bytes.fromHexString(event.params.payer.toHexString()) as Bytes
  let collectorAddress = Bytes.fromHexString(event.params.collector.toHexString()) as Bytes
  let receiverAddress = Bytes.fromHexString(event.params.receiver.toHexString()) as Bytes
  let tokensThawing = event.params.tokensThawing

  let graphNetwork = getOrCreateGraphNetwork()

  let payer = getOrCreatePayer(payerAddress, event.block.number, event.block.timestamp)
  assert(!payer.isNew, "Payer does not exist.")

  let collector = getOrCreateCollector(collectorAddress, event.block.number, event.block.timestamp)
  assert(!collector.isNew, "Collector does not exist.")

  let escrowAccount = getOrCreateEscrowAccount(
    payerAddress,
    collectorAddress,
    receiverAddress,
    event.block.number,
    event.block.timestamp
  )
  assert(!escrowAccount.isNew, "Escrow account does not exist.")

  // escrow account
  escrowAccount.entity.tokens = escrowAccount.entity.tokens.plus(tokensThawing)
  escrowAccount.entity.tokensThawing = BIGINT_ZERO
  escrowAccount.entity.thawEndTimestamp = BIGINT_ZERO
  saveEscrowAccount(escrowAccount.entity, event.block)

  // payer
  assert(payer.entity.tokensThawing >= tokensThawing, "Cancel tokens greater than payer tokens thawing.")
  payer.entity.tokensThawing = payer.entity.tokensThawing.minus(tokensThawing)
  savePayer(payer.entity, event.block)

  // collector
  assert(collector.entity.tokensThawing >= tokensThawing, "Cancel tokens greater than collector tokens thawing.")
  collector.entity.tokensThawing = collector.entity.tokensThawing.minus(tokensThawing)
  saveCollector(collector.entity, event.block)

  // GraphNetwork
  assert(graphNetwork.tokensThawingFromEscrow >= tokensThawing, "Cancel tokens greater than network tokens thawing.")
  graphNetwork.tokensThawingFromEscrow = graphNetwork.tokensThawingFromEscrow.minus(tokensThawing)
  saveGraphNetwork(graphNetwork)
}

/**
 * Handles Withdraw event from PaymentsEscrow.
 * Removes thawed tokens from escrow.
 */
export function handleWithdraw(event: Withdraw): void {
  let payerAddress = Bytes.fromHexString(event.params.payer.toHexString()) as Bytes
  let collectorAddress = Bytes.fromHexString(event.params.collector.toHexString()) as Bytes
  let receiverAddress = Bytes.fromHexString(event.params.receiver.toHexString()) as Bytes
  let tokens = event.params.tokens

  let graphNetwork = getOrCreateGraphNetwork()

  let payer = getOrCreatePayer(payerAddress, event.block.number, event.block.timestamp)
  assert(!payer.isNew, "Payer does not exist.")

  let collector = getOrCreateCollector(collectorAddress, event.block.number, event.block.timestamp)
  assert(!collector.isNew, "Collector does not exist.")

  let serviceProvider = getOrCreateServiceProvider(receiverAddress, event.block.number, event.block.timestamp)
  assert(!serviceProvider.isNew, "Service provider does not exist.")

  let escrowAccount = getOrCreateEscrowAccount(
    payerAddress,
    collectorAddress,
    receiverAddress,
    event.block.number,
    event.block.timestamp
  )
  assert(!escrowAccount.isNew, "Escrow account does not exist.")

  // escrow account
  assert(escrowAccount.entity.tokensThawing >= tokens, "Withdraw tokens greater than escrow account thawing tokens.")
  escrowAccount.entity.tokensThawing = escrowAccount.entity.tokensThawing.minus(tokens)
  saveEscrowAccount(escrowAccount.entity, event.block)

  // payer
  assert(payer.entity.tokensEscrowed >= tokens, "Withdraw tokens greater than payer tokens escrowed.")
  payer.entity.tokensEscrowed = payer.entity.tokensEscrowed.minus(tokens)
  assert(payer.entity.tokensThawing >= tokens, "Withdraw tokens greater than payer tokens thawing.")
  payer.entity.tokensThawing = payer.entity.tokensThawing.minus(tokens)
  savePayer(payer.entity, event.block)

  // collector
  assert(collector.entity.tokensEscrowed >= tokens, "Withdraw tokens greater than collector tokens escrowed.")
  collector.entity.tokensEscrowed = collector.entity.tokensEscrowed.minus(tokens)
  assert(collector.entity.tokensThawing >= tokens, "Withdraw tokens greater than collector tokens thawing.")
  collector.entity.tokensThawing = collector.entity.tokensThawing.minus(tokens)
  saveCollector(collector.entity, event.block)

  // service provider
  assert(serviceProvider.entity.tokensEscrowed >= tokens, "Withdraw tokens greater than service provider tokens escrowed.")
  serviceProvider.entity.tokensEscrowed = serviceProvider.entity.tokensEscrowed.minus(tokens)
  saveServiceProvider(serviceProvider.entity, event.block)

  // Graph Network
  graphNetwork.tokensEscrowed = graphNetwork.tokensEscrowed.minus(tokens)
  graphNetwork.tokensThawingFromEscrow = graphNetwork.tokensThawingFromEscrow.minus(tokens)
  saveGraphNetwork(graphNetwork)
}

/**
 * Handles EscrowCollected event from PaymentsEscrow.
 * Collector takes tokens from escrow to pay service provider.
 *
 * Note: EscrowCollected has paymentType as first param:
 * EscrowCollected(indexed uint8 paymentType, indexed address payer, indexed address collector, address receiver, uint256 tokens, address receiverDestination)
 */
export function handleEscrowCollected(event: EscrowCollected): void {
  let payerAddress = Bytes.fromHexString(event.params.payer.toHexString()) as Bytes
  let collectorAddress = Bytes.fromHexString(event.params.collector.toHexString()) as Bytes
  let receiverAddress = Bytes.fromHexString(event.params.receiver.toHexString()) as Bytes
  let tokens = event.params.tokens

  let graphNetwork = getOrCreateGraphNetwork()

  let payer = getOrCreatePayer(payerAddress, event.block.number, event.block.timestamp)
  assert(!payer.isNew, "Payer does not exist.")

  let collector = getOrCreateCollector(collectorAddress, event.block.number, event.block.timestamp)
  assert(!collector.isNew, "Collector does not exist.")

  let serviceProvider = getOrCreateServiceProvider(receiverAddress, event.block.number, event.block.timestamp)
  assert(!serviceProvider.isNew, "Service provider does not exist.")

  let escrowAccount = getOrCreateEscrowAccount(
    payerAddress,
    collectorAddress,
    receiverAddress,
    event.block.number,
    event.block.timestamp
  )
  assert(!escrowAccount.isNew, "Escrow account does not exist.")

  // escrow account
  assert(escrowAccount.entity.tokens >= tokens, "Collect tokens greater than escrow account tokens.")
  escrowAccount.entity.tokens = escrowAccount.entity.tokens.minus(tokens)
  escrowAccount.entity.tokensCollected = escrowAccount.entity.tokensCollected.plus(tokens)
  saveEscrowAccount(escrowAccount.entity, event.block)

  // payer
  assert(payer.entity.tokensEscrowed >= tokens, "Collect tokens greater than payer tokens escrowed.")
  payer.entity.tokensEscrowed = payer.entity.tokensEscrowed.minus(tokens)
  payer.entity.tokensCollected = payer.entity.tokensCollected.plus(tokens)
  savePayer(payer.entity, event.block)

  // collector
  assert(collector.entity.tokensEscrowed >= tokens, "Collect tokens greater than collector tokens escrowed.")
  collector.entity.tokensEscrowed = collector.entity.tokensEscrowed.minus(tokens)
  collector.entity.tokensCollected = collector.entity.tokensCollected.plus(tokens)
  saveCollector(collector.entity, event.block)

  // service provider
  assert(serviceProvider.entity.tokensEscrowed >= tokens, "Collect tokens greater than service provider tokens escrowed.")
  serviceProvider.entity.tokensEscrowed = serviceProvider.entity.tokensEscrowed.minus(tokens)
  saveServiceProvider(serviceProvider.entity, event.block)

  // GraphNetwork
  assert(graphNetwork.tokensEscrowed >= tokens, "Collect tokens greater than network tokens escrowed.")
  graphNetwork.tokensEscrowed = graphNetwork.tokensEscrowed.minus(tokens)
  saveGraphNetwork(graphNetwork)
}
