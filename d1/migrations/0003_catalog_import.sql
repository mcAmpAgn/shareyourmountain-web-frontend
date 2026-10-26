-- A catalog seed is immutable and can only be applied to a fresh database.
CREATE TABLE catalog_imports (
  id INTEGER PRIMARY KEY CHECK (id=1),
  sha256 TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  counts_json TEXT NOT NULL
);
