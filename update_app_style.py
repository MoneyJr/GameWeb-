with open('src/App.tsx', 'r') as f:
    app = f.read()

if 'resStyle' not in app:
    app = app.replace('const [visibleNoticeId, setVisibleNoticeId] = useState<number | null>(null)', 'const [visibleNoticeId, setVisibleNoticeId] = useState<number | null>(null)\n  const [resStyle, setResStyle] = useState<string>("EU")')
    app = app.replace('<BottomDock activeTool={sim.activeTool} onSelect={sim.setActiveTool} />', '<BottomDock activeTool={sim.activeTool} onSelect={sim.setActiveTool} resStyle={resStyle} onResStyleChange={setResStyle} />')
    
    with open('src/App.tsx', 'w') as f:
        f.write(app)
