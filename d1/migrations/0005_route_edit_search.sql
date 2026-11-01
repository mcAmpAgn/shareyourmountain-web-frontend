-- One-time indexed mapping avoids scanning the complete FTS catalog on every edit.
CREATE TABLE catalog_search_keys (
  entity_key TEXT PRIMARY KEY,
  search_rowid INTEGER NOT NULL UNIQUE
);
INSERT INTO catalog_search_keys(entity_key,search_rowid) SELECT entity_key,rowid FROM catalog_search;
CREATE TRIGGER route_edit_search AFTER UPDATE OF route_name,route_title ON route
WHEN NEW.route_status=1 BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM catalog_search_keys WHERE entity_key='r-'||NEW.id)
    THEN RAISE(ABORT,'Missing catalog search mapping') END;
  UPDATE catalog_search SET name=coalesce(nullif(trim(NEW.route_title),''),NEW.route_name)
    WHERE rowid=(SELECT search_rowid FROM catalog_search_keys WHERE entity_key='r-'||NEW.id);
END;
