CREATE TABLE material_entities (id TEXT PRIMARY KEY, name TEXT NOT NULL, cas TEXT NOT NULL DEFAULT '', payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE material_experiments (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, client_id TEXT NOT NULL, kind TEXT NOT NULL, local_id TEXT NOT NULL, name TEXT NOT NULL, project_ids TEXT NOT NULL, performed_date TEXT NOT NULL DEFAULT '', payload TEXT NOT NULL, fingerprint TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(owner_id,client_id,kind,local_id));
--> statement-breakpoint
CREATE TABLE material_lots (id TEXT PRIMARY KEY, material_id TEXT NOT NULL REFERENCES material_entities(id), number TEXT NOT NULL, manufacturer TEXT NOT NULL DEFAULT '', payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, source_experiment_id TEXT REFERENCES material_experiments(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(material_id,id), UNIQUE(material_id,number,manufacturer));
--> statement-breakpoint
CREATE TABLE material_aliases (owner_id TEXT NOT NULL, client_id TEXT NOT NULL, local_id TEXT NOT NULL, material_id TEXT NOT NULL REFERENCES material_entities(id), PRIMARY KEY(owner_id,client_id,local_id));
--> statement-breakpoint
CREATE TABLE material_lot_aliases (owner_id TEXT NOT NULL, client_id TEXT NOT NULL, local_material_id TEXT NOT NULL, local_lot_id TEXT NOT NULL, material_id TEXT NOT NULL REFERENCES material_entities(id), lot_id TEXT, PRIMARY KEY(owner_id,client_id,local_material_id,local_lot_id), FOREIGN KEY(material_id,lot_id) REFERENCES material_lots(material_id,id));
--> statement-breakpoint
CREATE TABLE material_usages (id TEXT PRIMARY KEY, experiment_id TEXT NOT NULL REFERENCES material_experiments(id), local_key TEXT NOT NULL, material_id TEXT NOT NULL REFERENCES material_entities(id), lot_id TEXT, role TEXT NOT NULL, planned_amount TEXT, planned_unit TEXT NOT NULL, actual_amount TEXT, actual_unit TEXT NOT NULL, snapshot TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(experiment_id,local_key), FOREIGN KEY(material_id,lot_id) REFERENCES material_lots(material_id,id));
--> statement-breakpoint
CREATE INDEX material_usage_material ON material_usages(material_id,lot_id,active);
--> statement-breakpoint
CREATE TABLE material_experiment_history (id TEXT PRIMARY KEY, experiment_id TEXT NOT NULL REFERENCES material_experiments(id), revision INTEGER NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE material_links (source_id TEXT NOT NULL REFERENCES material_experiments(id), target_kind TEXT NOT NULL, target_local_id TEXT NOT NULL, relation TEXT NOT NULL, PRIMARY KEY(source_id,target_kind,target_local_id,relation));

--> statement-breakpoint
CREATE UNIQUE INDEX material_output_batch ON material_lots(source_experiment_id) WHERE source_experiment_id IS NOT NULL;
