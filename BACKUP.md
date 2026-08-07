# Backup instructions

PowerShell (export .dump compressed custom format):

```powershell
$env:PGPASSWORD = '<DB_PASSWORD>'
pg_dump -h <DB_HOST> -p <DB_PORT> -U <DB_USER> -Fc -f C:\ruta\backup\drogueria_app_backup.dump <DB_NAME>
```

Restore (PowerShell):

```powershell
$env:PGPASSWORD = '<DB_PASSWORD>'
pg_restore -h <DB_HOST> -p <DB_PORT> -U <DB_USER> -d <DB_NAME> -c C:\ruta\backup\drogueria_app_backup.dump
```

Notes:
- Do not store backups inside the project repository.
- Replace `<DB_PASSWORD>`, `<DB_HOST>`, `<DB_PORT>` and `<DB_NAME>` with real values.
- Use DBeaver export if you prefer a GUI.
