-- Backfill once; public statistics must never scan the complete catalog per request.
CREATE TABLE catalog_totals (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  mountains INTEGER NOT NULL,
  routes INTEGER NOT NULL,
  total_mountains INTEGER NOT NULL,
  total_routes INTEGER NOT NULL
);
INSERT INTO catalog_totals
SELECT 1,
  (SELECT count(*) FROM mountain WHERE mntn_status = 1),
  (SELECT count(*) FROM route WHERE route_status = 1),
  (SELECT count(*) FROM mountain),
  (SELECT count(*) FROM route);

-- Deltas run in the same transaction as the catalog mutation, including rollback.
CREATE TRIGGER catalog_totals_mountain_insert AFTER INSERT ON mountain BEGIN
  UPDATE catalog_totals SET total_mountains = total_mountains + 1,
    mountains = mountains + coalesce(NEW.mntn_status = 1, 0) WHERE id = 1;
END;
CREATE TRIGGER catalog_totals_mountain_delete AFTER DELETE ON mountain BEGIN
  UPDATE catalog_totals SET total_mountains = total_mountains - 1,
    mountains = mountains - coalesce(OLD.mntn_status = 1, 0) WHERE id = 1;
END;
CREATE TRIGGER catalog_totals_mountain_status AFTER UPDATE OF mntn_status ON mountain BEGIN
  UPDATE catalog_totals SET mountains = mountains
    + coalesce(NEW.mntn_status = 1, 0) - coalesce(OLD.mntn_status = 1, 0) WHERE id = 1;
END;
CREATE TRIGGER catalog_totals_route_insert AFTER INSERT ON route BEGIN
  UPDATE catalog_totals SET total_routes = total_routes + 1,
    routes = routes + coalesce(NEW.route_status = 1, 0) WHERE id = 1;
END;
CREATE TRIGGER catalog_totals_route_delete AFTER DELETE ON route BEGIN
  UPDATE catalog_totals SET total_routes = total_routes - 1,
    routes = routes - coalesce(OLD.route_status = 1, 0) WHERE id = 1;
END;
CREATE TRIGGER catalog_totals_route_status AFTER UPDATE OF route_status ON route BEGIN
  UPDATE catalog_totals SET routes = routes
    + coalesce(NEW.route_status = 1, 0) - coalesce(OLD.route_status = 1, 0) WHERE id = 1;
END;
