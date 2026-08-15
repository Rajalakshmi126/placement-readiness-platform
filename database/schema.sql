USE placement_readiness_db;

ALTER TABLE companies
ADD COLUMN official_domain VARCHAR(255) NULL;