import re

with open('src/components/ui/TopBar.tsx', 'r') as f:
    tb = f.read()

tb = re.sub(r'function Stat\(\{ (.*?) \}: StatProps\)', r'function Stat({ \1, valueColor }: StatProps)', tb)

with open('src/components/ui/TopBar.tsx', 'w') as f:
    f.write(tb)
print("Fixed Stat props.")
