# Database maintenance, 3 November 2026

Project: viverepm project. Subscription confirmed: Free.

Applied migration: `20261103072959_vpm_private_restore_point_and_document_integrity`.

The live record contains five properties and three clients. A complete restore point of `public.app_data` was stored in `vpm_private.app_data_snapshots`, inaccessible to browser roles. This is a restore point inside the same database, not an independent disaster-recovery backup.

Added a validated constraint requiring arrays for properties, clients and operators, and an object for settings. Removed INSERT, DELETE, TRUNCATE, REFERENCES and TRIGGER grants from browser roles. Removed table-level UPDATE and allowed updates only to the existing application payload columns and timestamp. Browser clients cannot change the record ID. Existing SELECT and UPDATE policies are limited to the `main` record.

Verification: counts unchanged, restore point exactly matches live data, anonymous snapshot reads denied, prohibited operations denied, JSON constraint validated. Existing save path and negative checks tested in a transaction and rolled back.

## Remaining access-control work

The legacy application downloads and updates the shared JSON record before role-specific filtering. Anonymous SELECT and payload UPDATE remain permitted for compatibility. This maintenance does not make the application safe for production personal data. Full remediation requires coordinated frontend and server authorization changes, with separate owner-specific data access and a public reservation interface that cannot access client records or documents. Do not treat UI role checks as database authorization.

The security advisor reports no policies for the private restore-point table. That deny-by-default configuration is intentional. The pre-existing leaked-password-protection warning remains unchanged. No paid service, branch, scheduled backup plan or subscription was enabled.
