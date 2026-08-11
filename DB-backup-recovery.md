# Backing up and recovering the database

Our database contains important information for both financial and inventory purposes, not to mention employee and manager logins. This means it is important to be able to back up the database so that we can recover it at a later time if necessary.

Backing up the database is a simple affair. Simply run the command `pg_dump -h csce-315-db.engr.tamu.edu -U csce331_62 -d csce331_62 > backup` in the PowerShell terminal, replacing `backup` with the desired backup file name and inputting the password when prompted.

To recover the database from this backup file, simply run `psql -h csce-315-db.engr.tamu.edu -U csce331_62 -d csce331_62 < backup`, again replacing `backup` with the desired backup file name and inputting the password when prompted.