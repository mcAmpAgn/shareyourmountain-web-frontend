import { sqliteTable, integer, real, text } from 'drizzle-orm/sqlite-core';

export const geo_country = sqliteTable('geo_country', {
  id: integer('id').primaryKey(),
  country_name: text('country_name'),
  country_code: text('country_code'),
});

export const geo_region = sqliteTable('geo_region', {
  id: integer('id').primaryKey(),
  region_name: text('region_name').notNull(),
  country_id: integer('country_id').notNull(),
  country_code: text('country_code').notNull(),
  region_code: text('region_code').notNull(),
  region_wikipedia: text('region_wikipedia'),
});

export const geo_city = sqliteTable('geo_city', {
  id: integer('id').primaryKey(),
  city_name: text('city_name'),
  city_population: text('city_population'),
  city_latitude: real('city_latitude'),
  city_longitude: real('city_longitude'),
  country_id: integer('country_id'),
  country_code: text('country_code'),
  region_code: text('region_code'),
  region_id: integer('region_id'),
});

export const language = sqliteTable('language', {
  id: integer('id').primaryKey(),
  language_code: text('language_code'),
  language_name: text('language_name'),
});

export const act_activity = sqliteTable('act_activity', {
  id: integer('id').primaryKey(),
  activity_name: text('activity_name'),
  activity_description: text('activity_description'),
  activity_parent_id: integer('activity_parent_id'),
  activity_dateIns: text('activity_dateIns'),
  activity_status: integer('activity_status'),
  activity_order: integer('activity_order'),
});

export const act_difficulty = sqliteTable('act_difficulty', {
  id: integer('id').primaryKey(),
  actDifficulty_name: text('actDifficulty_name').notNull(),
  actDifficulty_grade: text('actDifficulty_grade').notNull(),
  actDifficulty_scale: text('actDifficulty_scale'),
  actDifficulty_dateIns: text('actDifficulty_dateIns'),
  activity_id: integer('activity_id'),
});

export const mntn_mountainrange = sqliteTable('mntn_mountainrange', {
  id: integer('id').primaryKey(),
  mntnRange_name: text('mntnRange_name'),
  mntnRange_dateIns: text('mntnRange_dateIns').notNull(),
  mntnRange_dateMod: text('mntnRange_dateMod'),
  mntnRange_parentId: integer('mntnRange_parentId'),
});

export const mntn_mountaingroup = sqliteTable('mntn_mountaingroup', {
  id: integer('id').primaryKey(),
  mntnGroup_name: text('mntnGroup_name'),
  mntnGroup_dateIns: text('mntnGroup_dateIns').notNull(),
  mntnRange_id: integer('mntnRange_id'),
});

export const valley = sqliteTable('valley', {
  id: integer('id').primaryKey(),
  valley_name: text('valley_name'),
  country_id: integer('country_id'),
  region_id: integer('region_id'),
  valley_parentId: integer('valley_parentId'),
  valley_lat: real('valley_lat'),
  valley_lng: real('valley_lng'),
  valley_dateIns: text('valley_dateIns').notNull(),
  valley_dateMod: text('valley_dateMod'),
});

export const stone = sqliteTable('stone', {
  id: integer('id').notNull(),
  language: integer('language').notNull(),
  stone_name: text('stone_name'),
  stone_dateIns: text('stone_dateIns'),
});

export const mountain = sqliteTable('mountain', {
  id: integer('id').primaryKey(),
  mntn_name: text('mntn_name').notNull(),
  mntn_description: text('mntn_description'),
  mntn_latitude: real('mntn_latitude'),
  mntn_longitude: real('mntn_longitude'),
  mntn_altitude: integer('mntn_altitude'),
  mntnRange_id: integer('mntnRange_id'),
  mntnGroup_id: integer('mntnGroup_id'),
  mntn_imageUrl: text('mntn_imageUrl'),
  mntn_firstAscent: text('mntn_firstAscent'),
  stone_id: integer('stone_id'),
  mntn_dateIns: text('mntn_dateIns').notNull(),
  mntn_dateMod: text('mntn_dateMod'),
  mntn_status: integer('mntn_status').notNull(),
  mntn_ranking: integer('mntn_ranking').notNull(),
});

export const ass_mountaincountry = sqliteTable('ass_mountaincountry', {
  mntn_id: integer('mntn_id').notNull(),
  country_id: integer('country_id').notNull(),
  country_code: text('country_code'),
  dateIns: text('dateIns'),
});

export const ass_mountainregion = sqliteTable('ass_mountainregion', {
  mntn_id: integer('mntn_id').notNull(),
  region_id: integer('region_id').notNull(),
  region_name: text('region_name'),
  country_id: integer('country_id').notNull(),
  dateIns: text('dateIns').notNull(),
});

export const mntn_dbpedia = sqliteTable('mntn_dbpedia', {
  id: integer('id').primaryKey(),
  dbpedia_id: text('dbpedia_id'),
  dbpedia_abstract: text('dbpedia_abstract'),
  language_id: integer('language_id'),
  dbpedia_url: text('dbpedia_url'),
  mountain_id: integer('mountain_id'),
  dbpedia_wikipageId: integer('dbpedia_wikipageId'),
  wikipedia_url: text('wikipedia_url'),
  dbpedia_dateIns: text('dbpedia_dateIns'),
  dbpedia_dateMod: text('dbpedia_dateMod'),
});

export const mntn_image = sqliteTable('mntn_image', {
  id: integer('id').primaryKey(),
  image_url: text('image_url').notNull(),
  image_json: text('image_json'),
  mountain_id: integer('mountain_id'),
  image_cover: integer('image_cover').notNull(),
  image_click: integer('image_click'),
  image_descr: text('image_descr'),
  image_filename: text('image_filename'),
  image_dateIns: text('image_dateIns').notNull(),
  image_dateMod: text('image_dateMod'),
  image_cdn: integer('image_cdn'),
});

export const parking = sqliteTable('parking', {
  id: integer('id').primaryKey(),
  parking_name: text('parking_name'),
  parking_free: integer('parking_free'),
  parking_lat: real('parking_lat'),
  parking_lng: real('parking_lng'),
  parking_dateIns: text('parking_dateIns').notNull(),
  parking_dateMod: text('parking_dateMod'),
  country_id: integer('country_id'),
  region_id: integer('region_id'),
  parking_altitude: integer('parking_altitude'),
});

export const trackgps = sqliteTable('trackgps', {
  id: integer('id').primaryKey(),
  track_name: text('track_name'),
  track_description: text('track_description'),
  track_url: text('track_url'),
  track_dateIns: text('track_dateIns').notNull(),
  track_dateMod: text('track_dateMod'),
});

export const route = sqliteTable('route', {
  id: integer('id').primaryKey(),
  route_name: text('route_name'),
  route_title: text('route_title'),
  route_area: text('route_area'),
  activity_id: integer('activity_id'),
  activityExt_id: integer('activityExt_id'),
  city_id: integer('city_id'),
  region_id: integer('region_id').notNull(),
  country_id: integer('country_id').notNull(),
  mountain_id: integer('mountain_id'),
  mntnGroup_id: integer('mntnGroup_id'),
  mntnRange_id: integer('mntnRange_id'),
  valley_id: integer('valley_id'),
  route_facing: text('route_facing'),
  route_length: integer('route_length'),
  route_lengthDescr: text('route_lengthDescr'),
  route_altitude: integer('route_altitude'),
  route_height: integer('route_height'),
  route_approachAltitude: integer('route_approachAltitude'),
  route_approachHeight: integer('route_approachHeight'),
  route_approachLength: integer('route_approachLength'),
  difficulty_grade: text('difficulty_grade'),
  route_lat: real('route_lat'),
  route_lng: real('route_lng'),
  route_pitchAsc: integer('route_pitchAsc'),
  route_pitchDesc: integer('route_pitchDesc'),
  route_status: integer('route_status'),
  route_dateIns: text('route_dateIns').notNull(),
  route_dateMod: text('route_dateMod'),
  route_firstAscDate: text('route_firstAscDate'),
  route_firstAscClimbers: text('route_firstAscClimbers'),
  parking_id: integer('parking_id'),
  trackgps_id: integer('trackgps_id'),
  route_ranking: integer('route_ranking'),
});

export const route_image = sqliteTable('route_image', {
  id: integer('id').primaryKey(),
  image_url: text('image_url'),
  image_json: text('image_json'),
  route_id: integer('route_id'),
  image_cover: integer('image_cover'),
  source_id: integer('source_id'),
  image_descr: text('image_descr'),
  image_filename: text('image_filename'),
  image_dateIns: text('image_dateIns'),
  image_dateMod: text('image_dateMod'),
  image_cdn: integer('image_cdn'),
});

export const source = sqliteTable('source', {
  id: integer('id').primaryKey(),
  source_name: text('source_name').notNull(),
  source_url: text('source_url'),
  source_logo: text('source_logo'),
  source_dateIns: text('source_dateIns').notNull(),
});

export const route_webinfo = sqliteTable('route_webinfo', {
  id: integer('id').primaryKey(),
  wi_url: text('wi_url').notNull(),
  wi_summary: text('wi_summary'),
  wi_rate: text('wi_rate'),
  language_code: text('language_code'),
  route_id: integer('route_id').notNull(),
  source_id: integer('source_id'),
  wi_dateIns: text('wi_dateIns').notNull(),
  wi_dateMod: text('wi_dateMod'),
});
