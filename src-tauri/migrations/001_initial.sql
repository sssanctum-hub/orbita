PRAGMA foreign_keys = ON;
CREATE TABLE metadata (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
INSERT INTO metadata VALUES (1,0);
CREATE TABLE projects (id TEXT PRIMARY KEY, position INTEGER NOT NULL, payload TEXT NOT NULL);
CREATE TABLE tasks (id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id), position INTEGER NOT NULL, payload TEXT NOT NULL);
CREATE TABLE notes (id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id), position INTEGER NOT NULL, payload TEXT NOT NULL);
CREATE TABLE deliveries (delivery_key TEXT PRIMARY KEY, delivered_at TEXT NOT NULL);
PRAGMA user_version = 1;
