import json
from collections import defaultdict

CHUNK_SIZE = 10  # 10x10 tiles = 1km (bei 100m tiles)

def parse_tile_id(tile_id):
    x, y = tile_id.split("_")
    return int(x), int(y)

def get_chunk_id(x, y):
    return x // CHUNK_SIZE, y // CHUNK_SIZE

chunks = defaultdict(list)

print("Loading tiles...")
with open("game_tiles.json", "r") as f:
    tiles = json.load(f)

print("Chunking...")

for t in tiles:
    x, y = parse_tile_id(t["tile_id"])
    cx, cy = get_chunk_id(x, y)

    chunks[(cx, cy)].append({
        "x": x % CHUNK_SIZE,
        "y": y % CHUNK_SIZE,
        "zones": t["zones"]
    })

output = []

for (cx, cy), tiles in chunks.items():
    output.append({
        "chunk_x": cx,
        "chunk_y": cy,
        "tiles": tiles
    })

print("Saving chunks...")
with open("chunks.json", "w") as f:
    json.dump(output, f)

print("DONE → chunks.json erstellt")