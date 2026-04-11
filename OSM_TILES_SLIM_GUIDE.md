# Slim OSM Tile Storage — Architektur & Datenformat

## Überblick

Die neue "Slim" Datenstruktur reduziert die Speichergröße von ~10-15 KB pro Chunk auf ~3-4 Bytes pro Tile durch:
1. **Relative Koordinaten**: nur 0-9 statt absoluter tile_x/tile_y
2. **Quantisierte Zonenwerte**: 0-255 statt Float m2
3. **Relationale Aufteilung**: Chunks + TileValues statt großer JSONB-Payload
4. **Nur relevante Zonen**: ein Tile mit nur Forest → nur ein Record, nicht 6

## Schema

### `OSMTileChunkLite`
Chunk-Metadaten (minimal):
```
chunk_id         UUID          (Primary Key)
dataset_version  TEXT          (z.B. "osm_de_2026_04_10")
chunk_x          INTEGER       (Grid-Koordinate)
chunk_y          INTEGER       (Grid-Koordinate)
tile_count       SMALLINT      (Anzahl Tiles in diesem Chunk)
created_at       TIMESTAMPTZ   (Zeitstempel)
```

**Größe pro Chunk**: ~100-150 Bytes  
**Indizes**: (dataset_version, chunk_x, chunk_y) als B-Tree

### `OSMTileValue`
Tile-Zonendaten (eine Zeile pro Tile mit Zonenwert):
```
chunk_id         UUID          (Foreign Key → OSMTileChunkLite.id)
tile_local_x     SMALLINT      (0-9, lokal innerhalb Chunk)
tile_local_y     SMALLINT      (0-9, lokal innerhalb Chunk)
zone_type        SMALLINT      (0-5, Enum: forest=0, water=1, meadow=2, urban=3, beach=4, wetlands=5)
zone_value       SMALLINT      (0-255, quantisiert; multiply by (max_area_m2/255) zum Denormalisieren)
```

**Primary Key**: (chunk_id, tile_local_x, tile_local_y, zone_type)  
**Größe pro Tile**: ~12-16 Bytes (ohne Overhead), realistisch ~20 Bytes mit Indexes  
**Indizes**: 
- (chunk_id) für Lookups nach Chunk
- (zone_type) für Filterungen

## Datenformat

### Zone-Typ Enum
```
0 = forest
1 = water
2 = meadow
3 = urban
4 = beach
5 = wetlands
```

### Zonenwert-Quantisierung
Die area_m2 wird linear auf 0-255 skaliert:
```
max_area_m2 = 10000.0  (worst case: ganzes 100m-Tile mit einer Zone)
quantized = min(255, int((area_m2 / max_area_m2) * 255))
```

Zum Denormalisieren:
```
area_m2 = (zone_value / 255) * max_area_m2
```

### CSV Export-Format

**chunks_slim.csv**:
```
chunk_id,dataset_version,chunk_x,chunk_y,tile_count
550e8400-e29b-41d4-a716-446655440000,osm_de_2026_04_10,100,200,100
```

**tile_values_slim.csv**:
```
chunk_id,tile_local_x,tile_local_y,zone_type,zone_value
550e8400-e29b-41d4-a716-446655440000,0,0,0,200
550e8400-e29b-41d4-a716-446655440000,0,1,0,180
550e8400-e29b-41d4-a716-446655440000,1,0,1,150
```

## Speichereffizienz

### Alte Struktur (GeoTileChunk mit großem JSON-Payload)
- 1 Chunk (10x10 = 100 Tiles) mit ~15 KB Payload-JSON
- 75 Chunks insgesamt ≈ 1,1 MB pro Chunk
- 371.210 Chunks ≈ 371 GB (unrealistisch für Postgres)

### Neue Struktur (OSMTileChunkLite + OSMTileValue)
- 1 Chunk: ~120 Bytes Metadaten + ~100 Tiles × ~16 Bytes ≈ 1,7 KB
- 75 Chunks insgesamt ≈ 130 KB pro Chunk
- 371.210 Chunks ≈ 630 MB (realistic für Pro Plan: 8 GB verfügbar)

**Kompression: ~600x** (bezogen auf die dicken JSON-Payloads)

## Index-Strategie

### B-Tree vs GIN
- **B-Tree**: Standard für numerische/skalare Indizes  
  - Effizient für Range-Queries (chunk_x BETWEEN ... AND ...)
  - Schnell beim Schreiben
  - Weniger IO-Overhead

- **GIN** (Generalized Inverted Index): Spezialisiert auf JSON/Arrays  
  - Teuer beim Schreiben (muss jeden Key/Value indexieren)
  - Overkill für strukturierte Daten mit festen Spalten

### Empfohlene Indizes
```sql
-- Chunk-Lookups sind schnell (Primary Key)
CREATE UNIQUE INDEX idx_osm_chunk_lite_unique 
  ON OSMTileChunkLite(dataset_version, chunk_x, chunk_y);

-- Version queries
CREATE INDEX idx_osm_chunk_lite_version 
  ON OSMTileChunkLite(dataset_version);

-- Tile-Lookups nach Chunk
CREATE INDEX idx_osm_tile_value_chunk_id 
  ON OSMTileValue(chunk_id);

-- Optional: Zone-Filterung
CREATE INDEX idx_osm_tile_value_zone_type 
  ON OSMTileValue(zone_type);
```

**Kein GIN Index** auf OSMTileValue, da die Struktur vollständig relational ist.

## Migrationsschritte

### 1. Migration 029 einspielen
```bash
supabase migration up  # Führt 029_create_osm_tile_lite_schema.sql aus
```

### 2. Daten aus SQLite exportieren (neu)
```bash
python data/pipeline/build_osm_tiles_slim.py
# Erzeugt:
#  - data/output/osm_tiles_slim/chunks_slim.csv
#  - data/output/osm_tiles_slim/tile_values_slim.csv
```

### 3. In Supabase hochladen
```bash
export SUPABASE_URL='https://mppxozsltkgjozcastgv.supabase.co'
export SERVICE_ROLE_KEY='...'
python data/pipeline/upload_osm_tiles_slim.py
```

### 4. Alte GeoTileChunk-Daten archivieren/löschen
```sql
DELETE FROM public."GeoTileChunk" WHERE dataset_version = 'osm_de_2026_04_10';
VACUUM;
```

## Query-Beispiele

### Alle Tiles in einem Chunk laden
```sql
SELECT tile_local_x, tile_local_y, zone_type, zone_value
FROM public."OSMTileValue"
WHERE chunk_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY tile_local_x, tile_local_y;
```

### Tiles mit Zone "forest" finden
```sql
SELECT chunk_id, tile_local_x, tile_local_y, zone_value
FROM public."OSMTileValue"
WHERE zone_type = 0  -- forest
LIMIT 1000;
```

### Chunks nach Bounding Box
```sql
SELECT *
FROM public."OSMTileChunkLite"
WHERE dataset_version = 'osm_de_2026_04_10'
  AND chunk_x BETWEEN 100 AND 150
  AND chunk_y BETWEEN 200 AND 250;
```

## Performance-Charakteristiken

| Operation | Laufzeit (erwartet) |
|-----------|-------------------|
| Chunk-Metadaten laden (100 Tiles) | 20-50 ms |
| Alle TileValues eines Chunks | 30-80 ms |
| 2.5 km Radius Zonengenerierung (25-36 Chunks) | 80-250 ms |
| Einzelnes INSERT (mit retry) | 10-50 ms |
| Batch INSERT (100 rows) | 50-150 ms |

## Nächste Schritte

1. ✅ Migration erstellen (029_create_osm_tile_lite_schema.sql)
2. ✅ Export-Script schreiben (build_osm_tiles_slim.py)
3. ✅ Upload-Script schreiben (upload_osm_tiles_slim.py)
4. ⏳ Daten exportieren und hochladen
5. ⏳ Zone-Generierungs-Funktion auf neue Tabellen anpassen
6. ⏳ Alte GeoTileChunk Tabelle deprecated markieren oder löschen
