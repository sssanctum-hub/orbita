CREATE TABLE area_preferences (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);
INSERT INTO area_preferences VALUES (1,'{"deletedAreas":[],"areaIcons":{}}');
PRAGMA user_version = 3;
