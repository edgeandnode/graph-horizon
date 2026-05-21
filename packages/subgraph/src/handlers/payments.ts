import { Bytes } from "@graphprotocol/graph-ts"
import { GraphPaymentCollected } from "../../generated/GraphPayments/GraphPayments"
import { getOrCreateGraphNetwork, saveGraphNetwork } from "../entities/graphNetwork"
import { getOrCreateServiceProvider, saveServiceProvider } from "../entities/serviceProvider"
import { getOrCreateDataService, saveDataService } from "../entities/dataService"
import { getOrCreateProvision, saveProvision } from "../entities/provision"
import { getOrCreateDelegationPool, saveDelegationPool } from "../entities/delegationPool"

/**
 * Handles GraphPaymentCollected event from GraphPayments.
 * Updates payment collection aggregates across all relevant entities.
 */
export function handleGraphPaymentCollected(event: GraphPaymentCollected): void {
  let receiverAddress = Bytes.fromHexString(event.params.receiver.toHexString()) as Bytes
  let dataServiceAddress = Bytes.fromHexString(event.params.dataService.toHexString()) as Bytes
  let tokens = event.params.tokens
  let tokensProtocol = event.params.tokensProtocol
  let tokensDataService = event.params.tokensDataService
  let tokensDelegationPool = event.params.tokensDelegationPool
  let tokensReceiver = event.params.tokensReceiver

  let graphNetwork = getOrCreateGraphNetwork()

  // GraphNetwork
  graphNetwork.tokensCollected = graphNetwork.tokensCollected.plus(tokens)
  graphNetwork.tokensDistributedAsProtocolTax = graphNetwork.tokensDistributedAsProtocolTax.plus(tokensProtocol)
  graphNetwork.tokensDistributedToDataServices = graphNetwork.tokensDistributedToDataServices.plus(tokensDataService)
  graphNetwork.tokensDistributedToDelegationPools = graphNetwork.tokensDistributedToDelegationPools.plus(
    tokensDelegationPool
  )
  graphNetwork.tokensDistributedToServiceProviders = graphNetwork.tokensDistributedToServiceProviders.plus(tokensReceiver)
  saveGraphNetwork(graphNetwork)

  // ServiceProvider
  let serviceProvider = getOrCreateServiceProvider(receiverAddress, event.block.number, event.block.timestamp)
  if (serviceProvider.isNew) {
    graphNetwork.countServiceProviders += 1
    saveGraphNetwork(graphNetwork)
  }
  serviceProvider.entity.tokensCollected = serviceProvider.entity.tokensCollected.plus(tokens)
  serviceProvider.entity.tokensDistributedToServiceProvider = serviceProvider.entity.tokensDistributedToServiceProvider.plus(
    tokensReceiver
  )
  serviceProvider.entity.tokensDistributedAsProtocolTax = serviceProvider.entity.tokensDistributedAsProtocolTax.plus(
    tokensProtocol
  )
  serviceProvider.entity.tokensDistributedToDelegationPools = serviceProvider.entity.tokensDistributedToDelegationPools.plus(
    tokensDelegationPool
  )
  serviceProvider.entity.tokensDistributedToDataServices = serviceProvider.entity.tokensDistributedToDataServices.plus(
    tokensDataService
  )
  saveServiceProvider(serviceProvider.entity, event.block)

  // DataService
  let dataService = getOrCreateDataService(dataServiceAddress, event.block.number, event.block.timestamp)
  if (dataService.isNew) {
    graphNetwork.countDataServices += 1
    saveGraphNetwork(graphNetwork)
  }
  dataService.entity.tokensCollected = dataService.entity.tokensCollected.plus(tokens)
  dataService.entity.tokensDistributedToDataService = dataService.entity.tokensDistributedToDataService.plus(
    tokensDataService
  )
  dataService.entity.tokensDistributedAsProtocolTax = dataService.entity.tokensDistributedAsProtocolTax.plus(
    tokensProtocol
  )
  dataService.entity.tokensDistributedToDelegationPools = dataService.entity.tokensDistributedToDelegationPools.plus(
    tokensDelegationPool
  )
  dataService.entity.tokensDistributedToServiceProviders = dataService.entity.tokensDistributedToServiceProviders.plus(
    tokensReceiver
  )
  saveDataService(dataService.entity, event.block)

  // Provision
  let provision = getOrCreateProvision(receiverAddress, dataServiceAddress, event.block.number, event.block.timestamp)
  provision.entity.tokensCollected = provision.entity.tokensCollected.plus(tokens)
  saveProvision(provision.entity, event.block)

  // DelegationPool
  let delegationPool = getOrCreateDelegationPool(
    receiverAddress,
    dataServiceAddress,
    event.block.number,
    event.block.timestamp
  )
  delegationPool.entity.tokens = delegationPool.entity.tokens.plus(tokensDelegationPool)
  delegationPool.entity.tokensDistributed = delegationPool.entity.tokensDistributed.plus(tokensDelegationPool)
  saveDelegationPool(delegationPool.entity, event.block)
}
