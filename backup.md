## 1\. Architecture Overview

### Process Model

* **Main process + job queue** — No separate backup container. Backups and restores run via the existing job queue system.
* **Queues**:
  * `backup-execution` — Backup jobs (default: queued, processed by worker)
  * `restore-execution` — Restore jobs

### Storage Architecture

* **Strategy pattern**: `IStorageStrategy` interface with two implementations:
  * `LocalStorageStrategy` — Local filesystem via `fs-extra`
  * `SftpStorageStrategy` — Remote SFTP via `ssh2-sftp-client`
* **Factory**: `StorageStrategyFactory` instantiates the correct strategy based on `BackupTargetType`.

### Production Restore Coordination

* **Redis pub/sub**: Channel `phoenix:restore:signal` for cross-container coordination
* **Signals**:
  * `maintenance ON` — All `phoenix-system` replicas return 503 for non-ManageBackup writes
  * `restart` — All replicas call `process.exit(42)`; Docker restarts containers
* **RestoreSignalService** publishes/subscribes; no-op when Redis is not configured (development).
* **MaintenanceModeGuard** checks in-memory `isMaintenanceMode` flag, returns 503 during restore.

**Example: Trigger a Backup (GraphQL)**

```graphql
mutation {
  triggerBackup(configId: "abc-123", immediate: false) {
    id
    status
    startedAt
  }
}
```

---

## 2\. Environment Variables

### Database (pg_dump / psql)

| Variable | Purpose |
| --- | --- |
| `DB_HOST` | PostgreSQL host |
| `DB_PORT` | PostgreSQL port |
| `DB_USERNAME` | DB user |
| `DB_PASSWORD` | DB password |
| `DB_NAME` | Database name |

### Assets

| Variable | Purpose |
| --- | --- |
| `ASSETS_UPLOAD_DIRECTORY` | Optional. Asset root; fallback uses `buildAssetsDirectoryPath()` |

### Disk Space

| Variable | Default | Purpose |
| --- | --- | --- |
| `BACKUP_DISK_SPACE_MARGIN_MB` | 5120 | Safety margin (MB) added to required space |
| `BACKUP_DB_SIZE_FACTOR` | 2.0 | Multiplier for `pg_database_size` to estimate pg_dump size |
| `BACKUP_EXTRACTION_FACTOR` | 4.0 | Multiplier for tar.gz extraction when `gzip -l` unavailable |

### SFTP Cache (downloads)

| Variable | Purpose |
| --- | --- |
| `SFTP_BACKUP_CACHE_MINUTES` | Cache duration for SFTP downloads (precedence) |
| `SFTP_BACKUP_CACHE_HOURS` | Cache duration (used if minutes not set) |
| Default | 24 hours |

### Redis (production)

| Variable | Purpose |
| --- | --- |
| `REDIS_HOST` | Redis host (default: `redis`) |
| `REDIS_PASSWORD` | Redis password |

### Development

| Variable | Purpose |
| --- | --- |
| `AUTO_RESTART_IN_DEV_MODE` | `true` in `packages/dev-server/.env` for restore/rollback testing. Restarts backend/worker on exit 42; disables file-watch (`--respawn`). |

**Example: Minimal `.env` for Local Dev**

```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=phoenix
DB_PASSWORD=yourpassword
DB_NAME=phoenix
```

**Example: Enable Restore Testing in Dev**

```
# packages/dev-server/.env
AUTO_RESTART_IN_DEV_MODE=true
```

---

## 3\. Key Services and Files

### Backend

| Service | File | Role |
| --- | --- | --- |
| BackupService | `packages/core/src/service/services/backup.service.ts` | Main backup orchestration, job queue, pg_dump |
| BackupConfigService | `packages/core/src/service/services/backup-config.service.ts` | CRUD for BackupConfig |
| BackupTargetService | `packages/core/src/service/services/backup-target.service.ts` | CRUD for BackupTarget |
| BackupExecutionService | `packages/core/src/service/services/backup-execution.service.ts` | CRUD for BackupExecution |
| BackupStorageService | `packages/core/src/service/services/backup-storage.service.ts` | Storage abstraction, delegates to strategies |
| BackupDownloadService | `packages/core/src/service/services/backup-download.service.ts` | Token-based secure downloads |
| RestoreService | `packages/core/src/service/services/restore.service.ts` | Restore orchestration, job queue, validation |
| RestoreSignalService | `packages/core/src/service/services/restore-signal.service.ts` | Redis pub/sub for maintenance/restart |
| DiskSpaceService | `packages/core/src/service/services/disk-space.service.ts` | Pre-operation disk space checks |

### Storage Strategies

| Strategy | File |
| --- | --- |
| LocalStorageStrategy | `packages/core/src/service/services/backup-storage/strategies/local-storage.strategy.ts` |
| SftpStorageStrategy | `packages/core/src/service/services/backup-storage/strategies/sftp-storage.strategy.ts` |
| StorageStrategyFactory | `packages/core/src/service/services/backup-storage/storage-strategy-factory.ts` |
| IStorageStrategy | `packages/core/src/service/services/backup-storage/strategies/storage-strategy.interface.ts` |

### GraphQL

| File | Role |
| --- | --- |
| `packages/core/src/resolver/backup.resolver.ts` | All backup/restore queries and mutations |

### Frontend

| Component / Service | Path |
| --- | --- |
| BackupConfigListWidget | `packages/phoenix-ui/src/app/modules/admin/components/backup-config-list-widget/` |
| BackupConfigDetailDialog | `packages/phoenix-ui/src/app/modules/admin/components/backup-config-detail-dialog/` |
| BackupRestoreDialog | `packages/phoenix-ui/src/app/modules/admin/components/backup-restore-dialog/` |
| RestoreConfirmationDialog | `packages/phoenix-ui/src/app/modules/admin/components/restore-confirmation-dialog/` |
| BackupStorageFiles | `packages/phoenix-ui/src/app/modules/admin/components/backup-storage-files/` |
| BackupUploadQueueService | `packages/phoenix-ui/src/app/modules/admin/services/backup-upload-queue.service.ts` |
| BackupConfigEditWidget | `packages/phoenix-ui/src/app/modules/admin/components/backup-config-edit-widget/` |
| BackupConfigService (UI) | `packages/phoenix-ui/src/app/modules/admin/services/backup-config.service.ts` |
| Backup schedule time helper | `packages/phoenix-ui/src/app/modules/admin/utils/backup-schedule-time-normalize.ts` (+ `backup-schedule-time-normalize.spec.ts`) |

---

#### Schedule time (`scheduleTime`) — UI to GraphQL

* `scheduleTime` is a GraphQL **String** scalar (e.g. `"03:00"`). It must never be sent as an empty object (`{}`); that breaks the mutation input (GraphQL expects a string).
* **Normalization** (`normalizeBackupScheduleTimeScalar` in `backup-schedule-time-normalize.ts`): `Date` → ISO string; valid strings pass through; invalid values and empty plain objects (`{}`) / nullish coalesce to `undefined` so they are omitted from the payload.
* **Call sites**: `BackupConfigEditWidget` save path (when `scheduleType` is `SCHEDULED` and frequency is not `HOURLY`), `BackupConfigService` (`normalizeScheduleTimeOnBackupConfigInput` before validation), and the Formly parser in `backup-config-edit-widget-fallback-fields.ts` (handles the `{}` edge case from DEV-2743).
* **Tests**: `backup-schedule-time-normalize.spec.ts` (Jasmine).
* **YouTrack**: DEV-2743.
* **Optional follow-up**: centralizing scalar coercion in `SystemService.validateObject` was left out of scope; backup-only logic stays in the admin module.

---

## 4\. Database Schema

### Entities

| Entity | Table | Purpose |
| --- | --- | --- |
| BackupConfig | `backup_config` | Backup configuration (schedule, type, target) |
| BackupTarget | `backup_target` | Storage target (LOCAL or SFTP) |
| BackupExecution | `backup_execution` | Per-run status, stats, file info |
| RestoreConfirmation | `restore_confirmation` | Pending confirm/reject after restore |
| BackupDownloadToken | `backup_download_token` | Token-based download URLs |

### Enums (from `@phoenix/common`)

| Enum | Values |
| --- | --- |
| BackupTargetType | SFTP, LOCAL |
| BackupScheduleType | MANUAL, SCHEDULED |
| BackupType | DATABASE_ONLY, FULL |
| BackupExecutionStatus | PENDING, RUNNING, COMPLETED, FAILED, CORRUPTED |
| RestoreConfirmationStatus | PENDING_CONFIRMATION, CONFIRMED, REJECTED, EXPIRED, CLEANED_UP |
| BackupScheduleFrequency | HOURLY, DAILY, WEEKLY, MONTHLY, YEARLY |

---

## 5\. Job Queue Integration

### Backup Queue

* **Queue name**: `backup-execution` (from `@phoenix/common` `BACKUP_QUEUE_NAME`)
* **Registration**: `BackupService.onModuleInit()`
* **Job data**: `{ configId, executionId, serializedCtx }`
* **Scheduled backups**: Use `ignoreUntil`; job is processed when `ignoreUntil <= now`
* **Dormant jobs**: `ignoreUntil` in the future — excluded from stuck-job checks via `backup-job-utils.ts`

### Restore Queue

* **Queue name**: `restore-execution` (from `@phoenix/common` `RESTORE_QUEUE_NAME`)
* **Job data**: `{ executionId, options, serializedCtx }`
* **Retries**: 0 (no automatic retries)

### Stuck Jobs

* **Query**: `getStuckBackupJobs` — Returns actively blocking jobs (PENDING/RUNNING, no future `ignoreUntil`)
* **Mutation**: `markBackupJobAsFailed(id)` — Sets job to FAILED to unblock restore
* **Utils**: `packages/core/src/service/helpers/utils/backup-job-utils.ts` — `getActiveJobIgnoreUntilCondition`, `ACTIVE_JOB_IGNORE_UNTIL_SQL`

---

## 6\. GraphQL API

### Mutations

| Mutation | Purpose |
| --- | --- |
| `createBackupConfig` | Create backup configuration |
| `updateBackupConfig` | Update backup configuration |
| `deleteBackupConfig` | Delete backup configuration |
| `triggerBackup` | Manual backup (default: queued) |
| `createBackupTarget` | Create backup target |
| `updateBackupTarget` | Update backup target |
| `deleteBackupTarget` | Delete backup target |
| `testBackupTarget` | Test storage connection |
| `restoreFromBackup` | Restore from BackupExecution |
| `restoreFromUpload` | Upload file and restore (`targetId` optional) |
| `restoreFromStorage` | Restore from file in storage |
| `confirmRestore` | Confirm or reject restore |
| `cleanupExpiredBackupDatabase` | Retry drop when auto-cleanup fails |
| `cleanupRetentionPolicies` | Manual retention cleanup (per-config or all) |
| `markBackupJobAsFailed` | Mark stuck job as FAILED |
| `deleteBackupStorageFile` | Delete file and related executions |

### Queries

| Query | Purpose |
| --- | --- |
| `backupConfigs` | List backup configurations (paginated) |
| `backupConfig` | Single config by ID |
| `backupTargets` | List backup targets (paginated) |
| `backupTarget` | Single target by ID |
| `backupExecutions` | List executions (optional `configId`) |
| `backupExecution` | Single execution by ID |
| `listBackupTargetFiles` | List files in storage (`BackupFileInfo\\[\\]`) |
| `backupDownloadUrl` | Secure download URL for execution |
| `getPendingRestoreConfirmation` | Pending confirmation (Public) |
| `getExpiredRestoreConfirmations` | Expired confirmations for cleanup UI |
| `getStuckBackupJobs` | Actively blocking jobs |

**Example: Create Backup Config via GraphQL**

```graphql
mutation {
  createBackupConfig(input: {
    identifier: "daily-full"
    backupType: DATABASE_ONLY
    scheduleType: SCHEDULED
    scheduleFrequency: DAILY
    scheduleTime: "03:00"
    retentionDays: 30
    targetId: "target-uuid"
  }) {
    id
    nextScheduledAt
  }
}
```

**Example: Restore from Storage File**

```graphql
mutation {
  restoreFromStorage(
    targetId: "target-uuid"
    fileName: "backup-2025-03-03T10-00-00-full.tar.gz"
    options: { includeAssets: true }
  ) {
    id
    status
  }
}
```

---

## 7\. Storage Strategy Interface

`IStorageStrategy` methods:

| Method | Signature | Purpose |
| --- | --- | --- |
| `uploadFile` | `(ctx, storagePath, localFilePath, remoteFileName)` | Upload backup file |
| `downloadFile` | `(ctx, storagePath, remoteFileName, localFilePath)` | Download from storage |
| `listFiles` | `(ctx, storagePath)` | List file names |
| `listFilesWithMetadata` | `(ctx, storagePath)` → `BackupFileInfo\\[\\]` | List with size, date |
| `deleteFile` | `(ctx, storagePath, fileName)` | Delete file |
| `testConnection` | `(ctx, storagePath)` → `{ success, error? }` | Test connectivity |

**Example: Strategy Usage (BackupStorageService delegates)**

```typescript
// BackupStorageService gets strategy from factory
const strategy = this.storageStrategyFactory.createStrategy(target.backupTargetType);
await strategy.uploadFile(ctx, storagePath, localFilePath, remoteFileName);
```

---

## 8\. Development Setup

### Running the worker

```bash
yarn dev:worker
```

Required for queued backups; worker processes `backup-execution` jobs.

### Restore and rollback testing

1. Add to `packages/dev-server/.env`:

   ```
   AUTO_RESTART_IN_DEV_MODE=true
   ```

2. Restore/rollback will trigger `process.exit(42)`; the wrapper restarts the process (matches Docker behavior).

3. **Note**: File-watch (`--respawn`) is disabled when this is enabled.

### E2E tests

* **Spec**: `packages/core/e2e/backup-restore-full.e2e-spec.ts`
* **Test attributes**: `data-testid` on backup components for automation

**Example: Run E2E Backup Tests**

```bash
cd packages/core && yarn e2e:backup-full
```

---

## 9\. Production Deployment

### Redis

* Use existing `phoenix-redis` instance.
* **Channel**: `phoenix:restore:signal`
* **Config**: `{ host: REDIS_HOST || 'redis', port: 6379, password: REDIS_PASSWORD }`

### Docker

* **Volume**: `phoenix-backups` named volume for LOCAL targets (shared by phoenix-system and phoenix-worker).
* **Default path**: `BACKUP_DEFAULT_STORAGE_PATH` from `@phoenix/common`.

### Maintenance mode

* **MaintenanceModeGuard** returns HTTP 503 during restore.
* **Exceptions**: health, reads, `getPendingRestoreConfirmation`, `confirmRestore`, ManageBackup users.
* **Timeout**: `MAINTENANCE_TIMEOUT_MS` (45 min) — auto-exit if no restart signal.

### Nginx

* **Large uploads**: `client_max_body_size 10g` for backup file uploads.
* Configure in `packages/phoenix-ui/nginx/nginx.conf`.

---

## 10\. File Structure Reference

```
packages/core/src/
├── models/backup/
│   ├── backup-config.model.ts
│   ├── backup-execution.model.ts
│   ├── backup-target.model.ts
│   ├── backup-file-info.model.ts
│   ├── backup-connection-info.types.ts
│   ├── backup-download-token.model.ts
│   └── restore-confirmation.model.ts
├── enums/
│   ├── backup-target-type.ts
│   ├── backup-execution-status.ts
│   ├── backup-schedule-type.ts
│   ├── backup-type.ts
│   ├── backup-schedule-frequency.ts
│   └── restore-confirmation-status.ts
├── service/
│   ├── services/
│   │   ├── backup.service.ts
│   │   ├── backup-config.service.ts
│   │   ├── backup-target.service.ts
│   │   ├── backup-execution.service.ts
│   │   ├── backup-storage.service.ts
│   │   ├── backup-download.service.ts
│   │   ├── restore.service.ts
│   │   ├── restore-signal.service.ts
│   │   ├── disk-space.service.ts
│   │   └── backup-storage/
│   │       ├── storage-strategy-factory.ts
│   │       └── strategies/
│   │           ├── storage-strategy.interface.ts
│   │           ├── local-storage.strategy.ts
│   │           └── sftp-storage.strategy.ts
│   └── helpers/utils/
│       ├── backup-target-validation.ts
│       └── backup-job-utils.ts
├── resolver/
│   └── backup.resolver.ts
├── middleware/
│   └── maintenance-mode.guard.ts
├── api/controllers/
│   └── backup-download.controller.ts
└── config/
    └── database-config-helper.ts

packages/phoenix-ui/src/app/
├── data/definitions/
│   └── backup-definition.ts
└── modules/admin/
    ├── utils/
    │   ├── backup-schedule-time-normalize.ts
    │   └── backup-schedule-time-normalize.spec.ts
    ├── components/
    │   ├── backup-config-list-widget/
    │   ├── backup-config-detail-dialog/
    │   ├── backup-config-edit-widget/
    │   ├── backup-execution-list-widget/
    │   ├── backup-target-edit-widget/
    │   ├── backup-storage-files/
    │   ├── backup-storage-files-wrapper/
    │   ├── backup-file-upload/
    │   ├── backup-restore-dialog/
    │   ├── backup-stuck-jobs-dialog/
    │   ├── restore-confirmation-dialog/
    │   └── restore-confirmation-detail/
    └── services/
        ├── backup-config.service.ts
        ├── backup-target.service.ts
        ├── backup-execution.service.ts
        ├── backup-upload-queue.service.ts
        └── restore-confirmation.service.ts

packages/common/src/
├── shared-enums.ts        # Backup enums
└── shared-constants.ts    # BACKUP_QUEUE_NAME, RESTORE_QUEUE_NAME, etc.
```

---

## 11\. Shared Constants

From `@phoenix/common/shared-constants.ts`:

| Constant | Value | Purpose |
| --- | --- |
| `BACKUP_QUEUE_NAME` | `'backup-execution'` | Backup job queue |
| `RESTORE_QUEUE_NAME` | `'restore-execution'` | Restore job queue |
| `RESTORE_SIGNAL_CHANNEL` | `'phoenix:restore:signal'` | Redis channel |
| `BACKUP_DOWNLOADS_DIR` | `'backup-downloads'` | Temp download dir in assets |
| `BACKUP_TEMP_DIR` | `'temp-backups'` | Temp backup creation dir |
| `BACKUP_DEFAULT_STORAGE_PATH` | `'./backups'` | Default storage path |

---

For end-user instructions, see the [Backup & Restore User Guide](backup-restore-user-guide.md).
For full implementation details, see [ftp+backups_and_restore_implementation_plan.md](ftp+backups_and_restore_implementation_plan.md).