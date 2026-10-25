CREATE TABLE app_profiles (id TEXT PRIMARY KEY, display_name TEXT NOT NULL);
INSERT INTO app_profiles VALUES ('local','Il mio profilo locale');
CREATE TABLE adventures (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES app_profiles(id),
  mountain_id INTEGER REFERENCES mountain(id),
  route_id INTEGER REFERENCES route(id),
  status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','completed')),
  completed_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((mountain_id IS NOT NULL) + (route_id IS NOT NULL) = 1),
  CHECK ((status = 'completed' AND completed_at IS NOT NULL) OR (status = 'planned' AND completed_at IS NULL))
);
CREATE UNIQUE INDEX adventure_mountain_target ON adventures(profile_id,mountain_id) WHERE mountain_id IS NOT NULL;
CREATE UNIQUE INDEX adventure_route_target ON adventures(profile_id,route_id) WHERE route_id IS NOT NULL;
CREATE TABLE import_batches (
  id INTEGER PRIMARY KEY,
  sha256 TEXT NOT NULL UNIQUE,
  snapshot TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  report_json TEXT NOT NULL
);
CREATE TABLE import_issues (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES import_batches(id),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  field TEXT NOT NULL,
  reason TEXT NOT NULL,
  original_value TEXT
);
CREATE VIEW catalog_items AS
SELECT 'm-'||m.id AS key,m.id,'mountain' AS kind,m.mntn_name AS name,
  m.mntn_altitude AS elevation_m,coalesce(mr.mntnRange_name,'') AS range_name,
  coalesce(m.mntnRange_id,0) AS range_id,'' AS region_name,NULL AS region_id,
  '' AS activity_name,NULL AS activity_id,NULL AS difficulty_raw,
  m.mntn_latitude AS latitude,m.mntn_longitude AS longitude,
  NULL AS mountain_id,m.mntn_status AS active,
  (SELECT count(*) FROM route r WHERE r.mountain_id=m.id AND r.route_status=1) AS route_count,
  coalesce((SELECT group_concat(c.country_code,' · ') FROM ass_mountaincountry a JOIN geo_country c ON c.id=a.country_id WHERE a.mntn_id=m.id),'') AS countries,
  NULL AS country_id
FROM mountain m LEFT JOIN mntn_mountainrange mr ON mr.id=m.mntnRange_id
UNION ALL
SELECT 'r-'||r.id,r.id,'route',coalesce(nullif(trim(r.route_title),''),r.route_name),
  r.route_altitude,coalesce(mr.mntnRange_name,''),coalesce(r.mntnRange_id,m.mntnRange_id,0),
  coalesce(g.region_name,''),r.region_id,coalesce(a.activity_name,''),r.activity_id,r.difficulty_grade,
  r.route_lat,r.route_lng,r.mountain_id,r.route_status,0,
  coalesce(c.country_code,''),r.country_id
FROM route r
LEFT JOIN mountain m ON m.id=r.mountain_id
LEFT JOIN mntn_mountainrange mr ON mr.id=coalesce(r.mntnRange_id,m.mntnRange_id)
LEFT JOIN geo_region g ON g.id=r.region_id
LEFT JOIN geo_country c ON c.id=r.country_id
LEFT JOIN act_activity a ON a.id=r.activity_id;
CREATE VIRTUAL TABLE catalog_search USING fts5(entity_key UNINDEXED,name,location,tokenize='unicode61 remove_diacritics 2',prefix='2 3');
CREATE INDEX mountain_elevation ON mountain(mntn_status,mntn_altitude);
CREATE INDEX route_activity_region ON route(route_status,activity_id,region_id);
CREATE INDEX route_elevation ON route(route_status,route_altitude);
