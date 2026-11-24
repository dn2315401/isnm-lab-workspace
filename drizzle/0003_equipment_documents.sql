CREATE TABLE equipment_experiment_records (id TEXT PRIMARY KEY, equipment_id TEXT NOT NULL, owner_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE equipment_documents (id TEXT PRIMARY KEY, equipment_id TEXT NOT NULL, record_id TEXT REFERENCES equipment_experiment_records(id), kind TEXT NOT NULL CHECK(kind IN ('manual','experiment')), name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, sha256 TEXT NOT NULL, owner_id TEXT NOT NULL, created_at TEXT NOT NULL, chunk_count INTEGER NOT NULL, preview TEXT NOT NULL DEFAULT '', UNIQUE(equipment_id,kind,record_id,sha256));
--> statement-breakpoint
CREATE TABLE equipment_document_chunks (document_id TEXT NOT NULL REFERENCES equipment_documents(id), sequence INTEGER NOT NULL, content TEXT NOT NULL, PRIMARY KEY(document_id,sequence));
--> statement-breakpoint
CREATE INDEX equipment_document_lookup ON equipment_documents(equipment_id,kind,record_id);
--> statement-breakpoint
CREATE INDEX equipment_experiment_lookup ON equipment_experiment_records(equipment_id,created_at);

--> statement-breakpoint
CREATE UNIQUE INDEX equipment_document_hash ON equipment_documents(equipment_id,kind,COALESCE(record_id,''),sha256);
