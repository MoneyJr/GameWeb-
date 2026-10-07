with open('src/components/ui/BottomDock.tsx', 'r') as f:
    content = f.read()

# Replace icons
if 'TreePine' not in content:
    content = content.replace("import { Droplets", "import { Droplets, TreePine, Wind, Zap")

if '[ToolId.PARK]' not in content:
    defs = """  [ToolId.PARK]: { icon: TreePine, tint: 'bg-green-200' },
  [ToolId.WIND]: { icon: Wind, tint: 'bg-teal-200' },
  [ToolId.COAL]: { icon: Zap, tint: 'bg-stone-400' },
  [ToolId.BULLDOZE]: { icon: Hammer, tint: 'bg-red-300' }"""
    import re
    content = re.sub(r'\[ToolId\.BULLDOZE\]: \{.*?\}', defs, content)

# Change styling of button and add sub-menu
# The active button should have: transform: translateY(-8px) scale(1.05); transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
# hover: translateY(-3px)
# active (clicking): translateY(0px) scale(0.97)

with open('src/components/ui/BottomDock.tsx', 'w') as f:
    f.write(content)
print("Updated icons in BottomDock.")
