# Groups and ranges atlas

Open `/soiusa`. The atlas searches the imported `mntn_mountainrange` and `mntn_mountaingroup` reference tables. The original range dump describes its Alpine sections and subsections as derived from SOIUSA. This is a partial historical classification, not a complete official SOIUSA dataset: no official codes or intermediate levels are stored. Non-Alpine entries are available under “Tutto l’archivio”, clearly outside SOIUSA.

`GET /api/classification` returns only named ranges (id, name, parentId) and groups (id, name, rangeId), using two reference-table queries, shared by Node/SQLite and Workers/D1. The Worker caches this public response for one hour, with existing bounded memory and coalescing. Search, accent-insensitive filtering, hierarchy browsing and pagination run locally on this small response, without querying D1 per keystroke. No schema migration or catalog reimport is required.

Catalog links use `groupId` or `rangeId`. Range filtering includes descendants via a cycle-safe recursive UNION using the existing parent index. Group filtering uses the route’s explicit group or its parent mountain’s group when absent, mirroring card display. Inactive records remain excluded. Existing filters, validation and public-cache limits apply.

Classification reference: [ARPA Piemonte SOIUSA service](https://webgis.arpa.piemonte.it/ags/rest/services/topografia_dati_di_base/SOIUSA/MapServer). This service is linked for context; no external dataset is imported and no unverified SOIUSA codes are generated.
