-- Public catalog only. Legacy IDs and useful relationships are preserved.

CREATE TABLE "geo_country" (
  "id" INTEGER PRIMARY KEY,
  "country_name" TEXT DEFAULT NULL,
  "country_code" TEXT DEFAULT NULL
);

CREATE TABLE "geo_region" (
  "id" INTEGER PRIMARY KEY,
  "region_name" TEXT NOT NULL,
  "country_id" INTEGER NOT NULL,
  "country_code" TEXT NOT NULL,
  "region_code" TEXT NOT NULL,
  "region_wikipedia" TEXT DEFAULT NULL
);

CREATE UNIQUE INDEX "idx_geo_region_1" ON "geo_region" ("region_wikipedia");

CREATE INDEX "idx_geo_region_2" ON "geo_region" ("country_id");

CREATE TABLE "geo_city" (
  "id" INTEGER PRIMARY KEY,
  "city_name" TEXT DEFAULT NULL,
  "city_population" TEXT DEFAULT NULL,
  "city_latitude" REAL DEFAULT NULL CHECK ("city_latitude" BETWEEN -90 AND 90),
  "city_longitude" REAL DEFAULT NULL CHECK ("city_longitude" BETWEEN -180 AND 180),
  "country_id" INTEGER DEFAULT NULL,
  "country_code" TEXT DEFAULT NULL,
  "region_code" TEXT DEFAULT NULL,
  "region_id" INTEGER DEFAULT NULL,
  FOREIGN KEY ("country_id") REFERENCES "geo_country"("id") DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY ("region_id") REFERENCES "geo_region"("id") DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX "idx_geo_city_1" ON "geo_city" ("country_id");

CREATE INDEX "idx_geo_city_2" ON "geo_city" ("region_id");

CREATE TABLE "language" (
  "id" INTEGER PRIMARY KEY,
  "language_code" TEXT DEFAULT NULL,
  "language_name" TEXT DEFAULT NULL
);

CREATE TABLE "act_activity" (
  "id" INTEGER PRIMARY KEY,
  "activity_name" TEXT DEFAULT NULL,
  "activity_description" TEXT DEFAULT NULL,
  "activity_parent_id" INTEGER DEFAULT NULL,
  "activity_dateIns" TEXT DEFAULT CURRENT_TIMESTAMP,
  "activity_status" INTEGER DEFAULT 1 CHECK ("activity_status" IN (0,1)),
  "activity_order" INTEGER DEFAULT NULL,
  FOREIGN KEY ("activity_parent_id") REFERENCES "act_activity"("id") DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX "idx_act_activity_1" ON "act_activity" ("activity_parent_id");

CREATE TABLE "act_difficulty" (
  "id" INTEGER PRIMARY KEY,
  "actDifficulty_name" TEXT NOT NULL,
  "actDifficulty_grade" TEXT NOT NULL,
  "actDifficulty_scale" TEXT DEFAULT NULL,
  "actDifficulty_dateIns" TEXT DEFAULT CURRENT_TIMESTAMP,
  "activity_id" INTEGER DEFAULT NULL,
  FOREIGN KEY ("activity_id") REFERENCES "act_activity"("id") DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX "idx_act_difficulty_1" ON "act_difficulty" ("activity_id");

CREATE TABLE "mntn_mountainrange" (
  "id" INTEGER PRIMARY KEY,
  "mntnRange_name" TEXT DEFAULT NULL,
  "mntnRange_dateIns" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "mntnRange_dateMod" TEXT DEFAULT NULL,
  "mntnRange_parentId" INTEGER DEFAULT NULL,
  FOREIGN KEY ("mntnRange_parentId") REFERENCES "mntn_mountainrange"("id") DEFERRABLE INITIALLY DEFERRED
);

CREATE UNIQUE INDEX "idx_mntn_mountainrange_1" ON "mntn_mountainrange" ("mntnRange_name");

CREATE INDEX "idx_mntn_mountainrange_2" ON "mntn_mountainrange" ("mntnRange_parentId");

CREATE TABLE "mntn_mountaingroup" (
  "id" INTEGER PRIMARY KEY,
  "mntnGroup_name" TEXT DEFAULT NULL,
  "mntnGroup_dateIns" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "mntnRange_id" INTEGER DEFAULT NULL,
  FOREIGN KEY ("mntnRange_id") REFERENCES "mntn_mountainrange"("id") DEFERRABLE INITIALLY DEFERRED
);

CREATE UNIQUE INDEX "idx_mntn_mountaingroup_1" ON "mntn_mountaingroup" ("mntnGroup_name");

CREATE INDEX "idx_mntn_mountaingroup_2" ON "mntn_mountaingroup" ("mntnRange_id");

CREATE TABLE "valley" (
  "id" INTEGER PRIMARY KEY,
  "valley_name" TEXT DEFAULT NULL,
  "country_id" INTEGER DEFAULT NULL,
  "region_id" INTEGER DEFAULT NULL,
  "valley_parentId" INTEGER DEFAULT NULL,
  "valley_lat" REAL DEFAULT NULL CHECK ("valley_lat" BETWEEN -90 AND 90),
  "valley_lng" REAL DEFAULT NULL CHECK ("valley_lng" BETWEEN -180 AND 180),
  "valley_dateIns" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "valley_dateMod" TEXT DEFAULT NULL,
  FOREIGN KEY ("country_id") REFERENCES "geo_country"("id") DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY ("region_id") REFERENCES "geo_region"("id") DEFERRABLE INITIALLY DEFERRED
);

CREATE UNIQUE INDEX "idx_valley_1" ON "valley" ("valley_name");

CREATE INDEX "idx_valley_2" ON "valley" ("region_id");

CREATE INDEX "idx_valley_3" ON "valley" ("country_id");

-- MySQL allowed mountain.stone_id to reference a nonunique prefix of (id,language).
-- SQLite requires a real unique parent, so retain translations and add rock identities.
CREATE TABLE stone_types (id INTEGER PRIMARY KEY);
CREATE TABLE "stone" (
  "id" INTEGER NOT NULL,
  "language" INTEGER NOT NULL,
  "stone_name" TEXT DEFAULT NULL,
  "stone_dateIns" TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id", "language"),
  FOREIGN KEY ("id") REFERENCES stone_types(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE "mountain" (
  "id" INTEGER PRIMARY KEY,
  "mntn_name" TEXT NOT NULL,
  "mntn_description" TEXT DEFAULT NULL,
  "mntn_latitude" REAL DEFAULT NULL CHECK ("mntn_latitude" BETWEEN -90 AND 90),
  "mntn_longitude" REAL DEFAULT NULL CHECK ("mntn_longitude" BETWEEN -180 AND 180),
  "mntn_altitude" INTEGER DEFAULT NULL,
  "mntnRange_id" INTEGER DEFAULT NULL,
  "mntnGroup_id" INTEGER DEFAULT NULL,
  "mntn_imageUrl" TEXT DEFAULT NULL,
  "mntn_firstAscent" TEXT DEFAULT NULL,
  "stone_id" INTEGER DEFAULT NULL,
  "mntn_dateIns" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "mntn_dateMod" TEXT DEFAULT NULL,
  "mntn_status" INTEGER NOT NULL DEFAULT 1 CHECK ("mntn_status" IN (0,1)),
  "mntn_ranking" INTEGER NOT NULL DEFAULT '0',
  FOREIGN KEY ("mntnGroup_id") REFERENCES "mntn_mountaingroup"("id") DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY ("mntnRange_id") REFERENCES "mntn_mountainrange"("id") DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY ("stone_id") REFERENCES "stone_types"("id") DEFERRABLE INITIALLY DEFERRED
);

CREATE UNIQUE INDEX "idx_mountain_1" ON "mountain" ("mntn_name");

CREATE INDEX "idx_mountain_2" ON "mountain" ("mntnGroup_id");

CREATE INDEX "idx_mountain_3" ON "mountain" ("mntnRange_id");

CREATE INDEX "idx_mountain_4" ON "mountain" ("stone_id");

CREATE TABLE "ass_mountaincountry" (
  "mntn_id" INTEGER NOT NULL,
  "country_id" INTEGER NOT NULL,
  "country_code" TEXT DEFAULT NULL,
  "dateIns" TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("mntn_id", "country_id"),
  FOREIGN KEY ("country_id") REFERENCES "geo_country"("id") DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY ("mntn_id") REFERENCES "mountain"("id") DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX "idx_ass_mountaincountry_1" ON "ass_mountaincountry" ("country_id");

CREATE TABLE "ass_mountainregion" (
  "mntn_id" INTEGER NOT NULL,
  "region_id" INTEGER NOT NULL,
  "region_name" TEXT DEFAULT NULL,
  "country_id" INTEGER NOT NULL,
  "dateIns" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("mntn_id", "region_id"),
  FOREIGN KEY ("country_id") REFERENCES "geo_country"("id") DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY ("mntn_id") REFERENCES "mountain"("id") DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY ("region_id") REFERENCES "geo_region"("id") DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX "idx_ass_mountainregion_1" ON "ass_mountainregion" ("country_id");

CREATE INDEX "idx_ass_mountainregion_2" ON "ass_mountainregion" ("region_id");

CREATE TABLE "mntn_dbpedia" (
  "id" INTEGER PRIMARY KEY,
  "dbpedia_id" TEXT DEFAULT NULL,
  "dbpedia_abstract" TEXT DEFAULT NULL,
  "language_id" INTEGER DEFAULT NULL,
  "dbpedia_url" TEXT DEFAULT NULL,
  "mountain_id" INTEGER DEFAULT NULL,
  "dbpedia_wikipageId" INTEGER DEFAULT NULL,
  "wikipedia_url" TEXT DEFAULT NULL,
  "dbpedia_dateIns" TEXT DEFAULT CURRENT_TIMESTAMP,
  "dbpedia_dateMod" TEXT DEFAULT NULL,
  FOREIGN KEY ("language_id") REFERENCES "language"("id") DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY ("mountain_id") REFERENCES "mountain"("id") DEFERRABLE INITIALLY DEFERRED
);

CREATE UNIQUE INDEX "idx_mntn_dbpedia_1" ON "mntn_dbpedia" ("dbpedia_id");

CREATE INDEX "idx_mntn_dbpedia_2" ON "mntn_dbpedia" ("mountain_id");

CREATE INDEX "idx_mntn_dbpedia_3" ON "mntn_dbpedia" ("language_id");

CREATE TABLE "mntn_image" (
  "id" INTEGER PRIMARY KEY,
  "image_url" TEXT NOT NULL,
  "image_json" TEXT DEFAULT NULL,
  "mountain_id" INTEGER DEFAULT NULL,
  "image_cover" INTEGER NOT NULL DEFAULT 0 CHECK ("image_cover" IN (0,1)),
  "image_click" INTEGER DEFAULT NULL,
  "image_descr" TEXT DEFAULT NULL,
  "image_filename" TEXT DEFAULT NULL,
  "image_dateIns" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "image_dateMod" TEXT DEFAULT NULL,
  "image_cdn" INTEGER DEFAULT 0 CHECK ("image_cdn" IN (0,1)),
  FOREIGN KEY ("mountain_id") REFERENCES "mountain"("id") DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX "idx_mntn_image_1" ON "mntn_image" ("mountain_id");

CREATE TABLE "parking" (
  "id" INTEGER PRIMARY KEY,
  "parking_name" TEXT DEFAULT NULL,
  "parking_free" INTEGER DEFAULT 1 CHECK ("parking_free" IN (0,1)),
  "parking_lat" REAL DEFAULT NULL CHECK ("parking_lat" BETWEEN -90 AND 90),
  "parking_lng" REAL DEFAULT NULL CHECK ("parking_lng" BETWEEN -180 AND 180),
  "parking_dateIns" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "parking_dateMod" TEXT DEFAULT NULL,
  "country_id" INTEGER DEFAULT NULL,
  "region_id" INTEGER DEFAULT NULL,
  "parking_altitude" INTEGER DEFAULT NULL
);

CREATE TABLE "trackgps" (
  "id" INTEGER PRIMARY KEY,
  "track_name" TEXT DEFAULT NULL,
  "track_description" TEXT DEFAULT NULL,
  "track_url" TEXT DEFAULT NULL,
  "track_dateIns" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "track_dateMod" TEXT DEFAULT NULL
);

CREATE TABLE "route" (
  "id" INTEGER PRIMARY KEY,
  "route_name" TEXT DEFAULT NULL,
  "route_title" TEXT DEFAULT NULL,
  "route_area" TEXT DEFAULT NULL,
  "activity_id" INTEGER DEFAULT NULL,
  "activityExt_id" INTEGER DEFAULT NULL,
  "city_id" INTEGER DEFAULT NULL,
  "region_id" INTEGER NOT NULL,
  "country_id" INTEGER NOT NULL,
  "mountain_id" INTEGER DEFAULT NULL,
  "mntnGroup_id" INTEGER DEFAULT NULL,
  "mntnRange_id" INTEGER DEFAULT NULL,
  "valley_id" INTEGER DEFAULT NULL,
  "route_facing" TEXT DEFAULT NULL,
  "route_length" INTEGER DEFAULT '0',
  "route_lengthDescr" TEXT DEFAULT NULL,
  "route_altitude" INTEGER DEFAULT NULL,
  "route_height" INTEGER DEFAULT NULL,
  "route_approachAltitude" INTEGER DEFAULT NULL,
  "route_approachHeight" INTEGER DEFAULT NULL,
  "route_approachLength" INTEGER DEFAULT NULL,
  "difficulty_grade" TEXT DEFAULT NULL,
  "route_lat" REAL DEFAULT NULL CHECK ("route_lat" BETWEEN -90 AND 90),
  "route_lng" REAL DEFAULT NULL CHECK ("route_lng" BETWEEN -180 AND 180),
  "route_pitchAsc" INTEGER DEFAULT NULL,
  "route_pitchDesc" INTEGER DEFAULT NULL,
  "route_status" INTEGER DEFAULT 1 CHECK ("route_status" IN (0,1)),
  "route_dateIns" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "route_dateMod" TEXT DEFAULT NULL,
  "route_firstAscDate" TEXT DEFAULT NULL,
  "route_firstAscClimbers" TEXT DEFAULT NULL,
  "parking_id" INTEGER DEFAULT NULL,
  "trackgps_id" INTEGER DEFAULT NULL,
  "route_ranking" INTEGER DEFAULT '0',
  FOREIGN KEY ("activity_id") REFERENCES "act_activity"("id") DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY ("city_id") REFERENCES "geo_city"("id") DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY ("country_id") REFERENCES "geo_country"("id") DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY ("mntnGroup_id") REFERENCES "mntn_mountaingroup"("id") DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY ("mntnRange_id") REFERENCES "mntn_mountainrange"("id") DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY ("mountain_id") REFERENCES "mountain"("id") DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY ("parking_id") REFERENCES "parking"("id") DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY ("region_id") REFERENCES "geo_region"("id") DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY ("trackgps_id") REFERENCES "trackgps"("id") DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY ("valley_id") REFERENCES "valley"("id") DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX "idx_route_1" ON "route" ("mountain_id");

CREATE INDEX "idx_route_2" ON "route" ("activity_id");

CREATE INDEX "idx_route_3" ON "route" ("country_id");

CREATE INDEX "idx_route_4" ON "route" ("mntnRange_id");

CREATE INDEX "idx_route_5" ON "route" ("region_id");

CREATE INDEX "idx_route_6" ON "route" ("mntnGroup_id");

CREATE INDEX "idx_route_7" ON "route" ("valley_id");

CREATE INDEX "idx_route_8" ON "route" ("city_id");

CREATE INDEX "idx_route_9" ON "route" ("parking_id");

CREATE INDEX "idx_route_10" ON "route" ("trackgps_id");

CREATE TABLE "route_image" (
  "id" INTEGER PRIMARY KEY,
  "image_url" TEXT DEFAULT NULL,
  "image_json" TEXT DEFAULT NULL,
  "route_id" INTEGER DEFAULT NULL,
  "image_cover" INTEGER DEFAULT 0 CHECK ("image_cover" IN (0,1)),
  "source_id" INTEGER DEFAULT NULL,
  "image_descr" TEXT DEFAULT NULL,
  "image_filename" TEXT DEFAULT NULL,
  "image_dateIns" TEXT DEFAULT CURRENT_TIMESTAMP,
  "image_dateMod" TEXT DEFAULT NULL,
  "image_cdn" INTEGER DEFAULT 0 CHECK ("image_cdn" IN (0,1)),
  FOREIGN KEY ("route_id") REFERENCES "route"("id") DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY ("source_id") REFERENCES "source"("id") DEFERRABLE INITIALLY DEFERRED
);

CREATE UNIQUE INDEX "idx_route_image_1" ON "route_image" ("image_url");

CREATE INDEX "idx_route_image_2" ON "route_image" ("route_id");

CREATE INDEX "idx_route_image_3" ON "route_image" ("source_id");

CREATE TABLE "source" (
  "id" INTEGER PRIMARY KEY,
  "source_name" TEXT NOT NULL,
  "source_url" TEXT DEFAULT NULL,
  "source_logo" TEXT DEFAULT NULL,
  "source_dateIns" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "route_webinfo" (
  "id" INTEGER PRIMARY KEY,
  "wi_url" TEXT NOT NULL,
  "wi_summary" TEXT DEFAULT NULL,
  "wi_rate" TEXT DEFAULT NULL,
  "language_code" TEXT DEFAULT NULL,
  "route_id" INTEGER NOT NULL,
  "source_id" INTEGER DEFAULT NULL,
  "wi_dateIns" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "wi_dateMod" TEXT DEFAULT NULL,
  FOREIGN KEY ("route_id") REFERENCES "route"("id") DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY ("source_id") REFERENCES "source"("id") DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX "idx_route_webinfo_1" ON "route_webinfo" ("route_id");

CREATE INDEX "idx_route_webinfo_2" ON "route_webinfo" ("source_id");
