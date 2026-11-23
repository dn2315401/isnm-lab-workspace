-- Additive migration. Original material/lot/usage rows remain available for rollback.
CREATE TABLE material_pre_reagent_backup (kind TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, backed_up_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(kind,id));
--> statement-breakpoint
INSERT INTO material_pre_reagent_backup(kind,id,payload) SELECT 'material',id,json_object('row',json(payload),'name',name,'cas',cas,'revision',revision) FROM material_entities;
--> statement-breakpoint
INSERT INTO material_pre_reagent_backup(kind,id,payload) SELECT 'lot',id,json_object('row',json(payload),'material_id',material_id,'number',number,'manufacturer',manufacturer,'source_experiment_id',source_experiment_id,'revision',revision) FROM material_lots;
--> statement-breakpoint
INSERT INTO material_pre_reagent_backup(kind,id,payload) SELECT 'usage',id,json_object('material_id',material_id,'lot_id',lot_id,'snapshot',json(snapshot),'active',active) FROM material_usages;
--> statement-breakpoint
CREATE TABLE material_orders (id TEXT PRIMARY KEY, material_id TEXT NOT NULL REFERENCES material_entities(id), status TEXT NOT NULL CHECK(status IN ('Requested','Ordered','Shipping','Received','Cancelled')), payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, write_token TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE material_reagents (id TEXT PRIMARY KEY, material_id TEXT NOT NULL REFERENCES material_entities(id), internal_code TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('Active','Completed','Expired','Disposed','Archived')), payload TEXT NOT NULL, legacy_lot_id TEXT UNIQUE REFERENCES material_lots(id), order_id TEXT REFERENCES material_orders(id), source_key TEXT UNIQUE, review_required INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1, write_token TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(material_id,id), UNIQUE(material_id,internal_code));
--> statement-breakpoint
CREATE TABLE material_reagent_history (id TEXT PRIMARY KEY, reagent_id TEXT NOT NULL REFERENCES material_reagents(id), from_status TEXT, to_status TEXT NOT NULL, changed_date TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', actor_id TEXT NOT NULL, snapshot TEXT NOT NULL, created_at TEXT NOT NULL);
--> statement-breakpoint
ALTER TABLE material_usages ADD COLUMN reagent_id TEXT REFERENCES material_reagents(id);
--> statement-breakpoint
CREATE INDEX reagent_material_status ON material_reagents(material_id,status);
--> statement-breakpoint
CREATE INDEX reagent_usage ON material_usages(reagent_id,active);
--> statement-breakpoint
CREATE TRIGGER usage_reagent_material_insert BEFORE INSERT ON material_usages WHEN NEW.reagent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM material_reagents r WHERE r.id=NEW.reagent_id AND r.material_id=NEW.material_id) BEGIN SELECT RAISE(ABORT,'reagent material mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER usage_reagent_material_update BEFORE UPDATE OF reagent_id,material_id ON material_usages WHEN NEW.reagent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM material_reagents r WHERE r.id=NEW.reagent_id AND r.material_id=NEW.material_id) BEGIN SELECT RAISE(ABORT,'reagent material mismatch'); END;
--> statement-breakpoint
-- Preserve ambiguous legacy inventory, but keep it out of automatic bottle selection.
INSERT OR IGNORE INTO material_reagents (id,material_id,internal_code,status,payload,legacy_lot_id,source_key,review_required,created_by,created_at,updated_at)
SELECT 'reagent:legacy:'||l.id,l.material_id,'기존 시약 '||l.id,
 CASE json_extract(l.payload,'$.inventory.lifecycle') WHEN 'Active' THEN 'Active' WHEN 'Completed' THEN 'Completed' WHEN 'Depleted' THEN 'Completed' WHEN 'Expired' THEN 'Expired' WHEN 'Disposed' THEN 'Disposed' ELSE 'Archived' END,
 json_object('fields',json_extract(l.payload,'$.inventory'),'unit',COALESCE(json_extract(l.payload,'$.unit'),'g'),'manufacturingLot',l.number,'internalCode','기존 시약 '||l.id,'original',json(l.payload),'migrationReason','기존 개별 재고 정보 보존'),l.id,'lot:'||l.id,
 CASE WHEN CAST(json_extract(l.payload,'$.inventory.capacity') AS REAL)>0 AND json_extract(l.payload,'$.inventory.location') IN ('냉동실','냉장고','용매 시약장','산염기 시약장','상온 시약장 좌측','상온 시약장 우측') AND EXISTS(SELECT 1 FROM json_each(l.payload,'$.inventory') d WHERE d.key IN ('purchased','opened','received') AND length(d.value)=10 AND date(d.value,'+0 days')=d.value) THEN 0 ELSE 1 END,
 'migration',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM material_lots l WHERE l.source_experiment_id IS NULL AND json_type(l.payload,'$.inventory')='object';
--> statement-breakpoint
INSERT OR IGNORE INTO material_reagents (id,material_id,internal_code,status,payload,source_key,review_required,created_by,created_at,updated_at)
SELECT 'reagent:unassigned:'||m.id||':'||json_extract(e.value,'$.id'),m.id,'기존 시약 '||json_extract(e.value,'$.id'),
 CASE json_extract(e.value,'$.inventory.lifecycle') WHEN 'Active' THEN 'Active' WHEN 'Completed' THEN 'Completed' WHEN 'Depleted' THEN 'Completed' WHEN 'Expired' THEN 'Expired' WHEN 'Disposed' THEN 'Disposed' ELSE 'Archived' END,
 json_object('fields',json_extract(e.value,'$.inventory'),'unit',COALESCE(json_extract(e.value,'$.unit'),json_extract(m.payload,'$.unit'),'g'),'manufacturingLot','','internalCode','기존 시약 '||json_extract(e.value,'$.id'),'original',json(e.value),'legacyVirtualId',m.id||':unregistered:'||json_extract(e.value,'$.id'),'migrationReason','기존 개별 재고 정보 보존'),
 'unassigned:'||m.id||':'||json_extract(e.value,'$.id'),
 CASE WHEN CAST(json_extract(e.value,'$.inventory.capacity') AS REAL)>0 AND json_extract(e.value,'$.inventory.location') IN ('냉동실','냉장고','용매 시약장','산염기 시약장','상온 시약장 좌측','상온 시약장 우측') AND EXISTS(SELECT 1 FROM json_each(e.value,'$.inventory') d WHERE d.key IN ('purchased','opened','received') AND length(d.value)=10 AND date(d.value,'+0 days')=d.value) THEN 0 ELSE 1 END,
 'migration',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM material_entities m,json_each(m.payload,'$.unassignedInventories') e WHERE json_extract(e.value,'$.assignedLotId') IS NULL AND json_extract(e.value,'$.id') IS NOT NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO material_lots(id,material_id,number,manufacturer,payload,created_at,updated_at)
SELECT r.id,r.material_id,'reagent:'||r.id,'',json_object('id',r.id,'name',r.internal_code,'inventory',json_extract(r.payload,'$.fields'),'unit',json_extract(r.payload,'$.unit')),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM material_reagents r WHERE r.legacy_lot_id IS NULL AND r.review_required=0;
--> statement-breakpoint
UPDATE material_usages SET reagent_id=(SELECT r.id FROM material_reagents r WHERE r.material_id=material_usages.material_id AND r.legacy_lot_id=material_usages.lot_id AND r.review_required=0) WHERE reagent_id IS NULL;
