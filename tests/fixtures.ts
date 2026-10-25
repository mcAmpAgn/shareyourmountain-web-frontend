import { openDatabase, migrate } from '../src/server/db/connection.js';
import { importCatalog } from '../src/server/import/catalog-importer.js';
function table(name: string, columns: string[], rows: string[]) {
  return `CREATE TABLE \`${name}\` (\n${columns.map((c) => '  `' + c + '` TEXT').join(',\n')}\n) ENGINE=InnoDB;\nINSERT INTO \`${name}\` VALUES ${rows.map((row) => '(' + row + ')').join(',')};\n`;
}
export const fixtureSQL = [
  table('geo_country', ['id', 'country_name', 'country_code'], ["1,'Italia','IT'"]),
  table(
    'geo_region',
    ['id', 'region_name', 'country_id', 'country_code', 'region_code'],
    ["1,'Lombardia',1,'IT','LO'"],
  ),
  table('language', ['id', 'language_name', 'language_code'], ["1,'Italiano','it'"]),
  table(
    'act_activity',
    ['id', 'activity_name', 'activity_status'],
    ["6,'Trekking',b'1'", "7,'Via Ferrata',b'1'"],
  ),
  table('mntn_mountainrange', ['id', 'mntnRange_name'], ["1,'Alpi Pennine'"]),
  table('stone', ['id', 'language', 'stone_name'], ["1,1,'Calcare'", "1,2,'Limestone'"]),
  table(
    'mountain',
    [
      'id',
      'mntn_name',
      'mntn_latitude',
      'mntn_longitude',
      'mntn_altitude',
      'mntnRange_id',
      'mntn_status',
      'stone_id',
    ],
    [
      "10,'Cervino',45.9764,7.65833,4478,1,b'1',1",
      "11,'Täschhorn',99,7,4491,1,b'1',NULL",
      "12,'Cima inattiva',45,8,2000,1,b'0',NULL",
    ],
  ),
  table(
    'ass_mountaincountry',
    ['mntn_id', 'country_id', 'country_code'],
    ["10,1,'IT'", "11,1,'IT'"],
  ),
  table('ass_mountainregion', ['mntn_id', 'region_id', 'country_id'], ['10,1,1']),
  table(
    'route',
    [
      'id',
      'route_name',
      'route_title',
      'country_id',
      'region_id',
      'mountain_id',
      'activity_id',
      'route_status',
      'route_length',
      'difficulty_grade',
      'route_lat',
      'route_lng',
    ],
    [
      "1,'Sentiero','',1,1,NULL,6,b'1',0,'EE,I,F',NULL,NULL",
      "2,'Cresta','Cervino - Cresta',1,1,10,7,b'1',150,'F',NULL,NULL",
      "3,'Vecchia via','Vecchia via',1,1,10,6,b'0',0,NULL,NULL,NULL",
    ],
  ),
  table('source', ['id', 'source_name', 'source_url'], ["1,'Fonte alpina','https://example.org/'"]),
  table('route_webinfo', ['id', 'wi_url', 'route_id', 'source_id'], ["1,'report.html',1,1"]),
  // This table must never be copied or executed, regardless of its contents.
  "CREATE TABLE `aspnetusers` (`Id` TEXT);\nINSERT INTO `aspnetusers` VALUES ('private-account-marker');\n",
].join('\n');
export function fixtureDatabase(filename = ':memory:') {
  const db = openDatabase(filename);
  migrate(db);
  importCatalog(db, fixtureSQL, 'test-fixture', '2017-12-28');
  return db;
}
