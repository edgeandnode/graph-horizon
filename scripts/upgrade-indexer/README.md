### Setup

```bash
cd scripts/upgrade-indexer

kubectl exec -ti shell-0 -c indexer-cli -- bash -s < setup.sh
kubectl cp . shell-0:/ && kubectl exec shell-0 -- bash -c 'chmod +x /*.sh'
kubectl exec -ti shell-0 -- env BATCH_SIZE=2 bash -s < migrate.sh
```

### Migrate allos

```bash
cd scripts/upgrade-indexer
kubectl exec -ti shell-0 -- bash -s < migrate.sh
```

### Check status

```bash
cd scripts/upgrade-indexer
kubectl exec -ti shell-0 -- bash -s < status.sh
```

### Check allos diff

```bash
cd scripts/upgrade-indexer
kubectl exec -ti shell-0 -- bash -s < fetch.sh && \
kubectl cp shell-0:/allocations.json allos-snapshot-current.json && \
./compare.sh
```

### One script to rule them all

```bash
# Just do it
BATCH_SIZE=10 RUNS=3 ./run.sh
```

### Close duplicate legacy allocations (leave one open)

```bash
kubectl exec -ti shell-0 -- bash -s < fetch.sh
kubectl exec -ti shell-0 -- env DRY_RUN=false bash -s < close-duplicates.sh
```

### Create lost allocations

```bash
kubectl cp allos-snapshot-before.json shell-0:/allos-snapshot-before.json
kubectl exec -ti shell-0 -- env AFTER=allocations.json bash -s < create-lost.sh
```
### Recreate skipped allocations log

```bash
 kubectl exec -ti shell-0 -- bash -s < recreate-skipped.sh
```

### Other useful commands
```bash
graph indexer actions get --network arbitrum-one --source "horizon-bulk-reallocate" -w 24 --status failed
graph indexer allocations close --network arbitrum-one 0xf052f1d744a625ccc49e9df1359dc92bbfb5cf04 0x0 --force
```