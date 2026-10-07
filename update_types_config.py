import re

with open('src/types/city.ts', 'r') as f:
    content = f.read()

# Add to TileType
if 'PARK:' not in content:
    content = content.replace("WATER_PUMP: 'WATER_PUMP',", "WATER_PUMP: 'WATER_PUMP',\n  PARK: 'PARK',\n  WIND: 'WIND',\n  COAL: 'COAL',")

# Add to GridCell
if 'style?:' not in content:
    content = content.replace("level: number", "level: number\n  style?: 'EU' | 'US' | 'JP'\n  smog?: boolean")

# Add to ToolId
if 'PARK:' not in content:
    content = content.replace("WATER_PUMP: 'WATER_PUMP',", "WATER_PUMP: 'WATER_PUMP',\n  PARK: 'PARK',\n  WIND: 'WIND',\n  COAL: 'COAL',")

with open('src/types/city.ts', 'w') as f:
    f.write(content)

with open('src/lib/cityConfig.ts', 'r') as f:
    config = f.read()

if 'ToolId.PARK' not in config:
    defs = """  [ToolId.PARK]: { id: ToolId.PARK, label: 'Парк', hotkey: '7', cost: 80, tile: TileType.PARK },
  [ToolId.WIND]: { id: ToolId.WIND, label: 'Ветряк', hotkey: '8', cost: 250, tile: TileType.WIND },
  [ToolId.COAL]: { id: ToolId.COAL, label: 'ТЭС', hotkey: '9', cost: 500, tile: TileType.COAL },
  [ToolId.BULLDOZE]: { id: ToolId.BULLDOZE, label: 'Снос', hotkey: '0', cost: 0, tile: null }"""
    config = re.sub(r'\[ToolId\.BULLDOZE\]: \{.*?\}', defs, config, flags=re.DOTALL)
    
    order = """  ToolId.CURSOR,
  ToolId.ROAD,
  ToolId.RESIDENTIAL,
  ToolId.COMMERCIAL,
  ToolId.INDUSTRIAL,
  ToolId.WATER_PUMP,
  ToolId.PARK,
  ToolId.WIND,
  ToolId.COAL,
  ToolId.BULLDOZE"""
    config = re.sub(r'export const TOOL_ORDER.*?\[(.*?)\]', f'export const TOOL_ORDER: readonly ToolId[] = [\n{order}\n]', config, flags=re.DOTALL)

with open('src/lib/cityConfig.ts', 'w') as f:
    f.write(config)

print("Updated types and config.")
