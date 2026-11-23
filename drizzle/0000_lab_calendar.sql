CREATE TABLE calendar_members (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', approved INTEGER NOT NULL DEFAULT 0, can_create_lab INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE calendar_invites (email TEXT PRIMARY KEY, can_create_lab INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE calendar_events (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES calendar_members(id), created_by TEXT NOT NULL REFERENCES calendar_members(id), visibility TEXT NOT NULL CHECK(visibility IN ('lab','public','private')), start_date TEXT NOT NULL, end_date TEXT NOT NULL, payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
--> statement-breakpoint
CREATE INDEX calendar_event_owner ON calendar_events(owner_id);
--> statement-breakpoint
CREATE INDEX calendar_event_visibility ON calendar_events(visibility,start_date);
--> statement-breakpoint
