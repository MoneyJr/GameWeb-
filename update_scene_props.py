with open('src/components/3d/CityScene.tsx', 'r') as f:
    scene = f.read()

# TileModel props
scene = scene.replace('hasWater={cell.hasWater}', 'hasWater={cell.hasWater}\n              hasPower={cell.hasPower}\n              smog={cell.smog}\n              style={cell.style}')

# Smog overlay in InteractionLayer
# The InteractionLayer has hovered cell.
# <group position={cellToWorld(hovered.x, hovered.y)}>
#   <HoverHighlight color={highlightColor} />
# </group>
if 'SmogRadiusOverlay' not in scene:
    overlay = """
function SmogRadiusOverlay() {
  return (
    <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[5, 32]} />
      <meshBasicMaterial color="#ef4444" transparent opacity={0.15} depthWrite={false} />
    </mesh>
  )
}
"""
    scene = scene.replace('function HoverHighlight', overlay + '\nfunction HoverHighlight')
    
    hover_group = """      {hovered !== null && (
        <group position={cellToWorld(hovered.x, hovered.y)}>
          <HoverHighlight color={highlightColor} />
          {(activeTool === ToolId.COAL || activeTool === ToolId.INDUSTRIAL) && (
            <SmogRadiusOverlay />
          )}
        </group>
      )}"""
    
    import re
    scene = re.sub(r'\{hovered \!== null && \(\s*<group position=\{cellToWorld\(hovered\.x, hovered\.y\)\}>\s*<HoverHighlight color=\{highlightColor\} />\s*</group>\s*\)\}', hover_group, scene, flags=re.DOTALL)

with open('src/components/3d/CityScene.tsx', 'w') as f:
    f.write(scene)
