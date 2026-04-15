-- Optional manual migration if `users.phone` is missing (Hibernate ddl-auto=update usually adds it).
-- Safe to run once; ignore error if column already exists.
ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL;
