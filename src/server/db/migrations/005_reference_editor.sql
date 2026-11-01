-- Support duplicate checks and bounded editor source lookup without scanning the catalog.
CREATE INDEX idx_source_editor_url ON source(source_url);
CREATE INDEX idx_source_editor_name ON source(source_name COLLATE NOCASE);
CREATE INDEX idx_route_webinfo_editor_url ON route_webinfo(route_id,wi_url);
