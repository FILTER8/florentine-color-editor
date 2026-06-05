'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchTokenMetadata, type TokenMetadata } from '../lib/token';

type RGB = { r: number; g: number; b: number };
type PaletteItem = { original: string; replacement: string; count: number };
type GridMode = 1 | 2 | 3;

const PRESET_PALETTES = [
  { name: 'DMG', colors: ['#e0f8d0', '#88c070', '#346856', '#081820'] },
  { name: 'SGB 1A', colors: ['#f8e8c8', '#d89048', '#a82820', '#301850'] },
  { name: 'SGB 2A', colors: ['#f8d8b8', '#e0a878', '#78c838', '#002030'] },
  { name: 'SGB 3A', colors: ['#f8d8b8', '#78d8f8', '#0078a8', '#483098'] },
  { name: 'SGB 4A', colors: ['#f8c090', '#78a8ff', '#2838d8', '#180898'] },

  { name: 'SGB 1B', colors: ['#d8d0c0', '#b8b090', '#706840', '#181818'] },
  { name: 'SGB 2B', colors: ['#f8f8f8', '#f0d878', '#b84898', '#481878'] },
  { name: 'SGB 3B', colors: ['#d8d8c8', '#f8b048', '#c86800', '#202020'] },
  { name: 'SGB 4B', colors: ['#f0e8f0', '#c8b8c8', '#806880', '#202020'] },

  { name: 'SGB 1C', colors: ['#f0d8f8', '#c090d8', '#7868c0', '#303060'] },
  { name: 'SGB 2C', colors: ['#f8d8f8', '#d8a0f8', '#7878f8', '#383098'] },
  { name: 'SGB 3C', colors: ['#e8c8d8', '#c8a8c8', '#9070a8', '#483060'] },
  { name: 'SGB 4C', colors: ['#f0d8e0', '#d8c0d0', '#907890', '#302030'] },

  { name: 'SGB 1D', colors: ['#ffffb8', '#f8e050', '#a85020', '#301000'] },
  { name: 'SGB 2D', colors: ['#f8f8a8', '#78f838', '#00a000', '#003000'] },
  { name: 'SGB 3D', colors: ['#f8f8c8', '#c8c870', '#707030', '#202010'] },
  { name: 'SGB 4D', colors: ['#f8f8c8', '#a8c0c0', '#486878', '#183848'] },

  { name: 'SGB 1E', colors: ['#f8d8b8', '#c8a070', '#609850', '#204830'] },
  { name: 'SGB 2E', colors: ['#f8c888', '#d89850', '#5070b0', '#102850'] },
  { name: 'SGB 3E', colors: ['#f8f8c8', '#d8c080', '#908050', '#383020'] },
  { name: 'SGB 4E', colors: ['#f8d8b8', '#d8b080', '#807060', '#203040'] },

  { name: 'SGB 1F', colors: ['#d8e8f8', '#78c8f8', '#407850', '#102018'] },
  { name: 'SGB 2F', colors: ['#c8f0f8', '#78d8e8', '#d85020', '#401000'] },
  { name: 'SGB 3F', colors: ['#8078c8', '#c050c8', '#603878', '#202020'] },
  { name: 'SGB 4F', colors: ['#c8e8e8', '#78b8c8', '#a04098', '#301020'] },

  { name: 'SGB 1G', colors: ['#000080', '#0080ff', '#ffffff', '#101010'] },
  { name: 'SGB 2G', colors: ['#78d830', '#509020', '#d84848', '#202020'] },
  { name: 'SGB 3G', colors: ['#70e060', '#38a838', '#ffffff', '#202020'] },
  { name: 'SGB 4G', colors: ['#a8f000', '#58b838', '#d84848', '#303030'] },

  { name: 'SGB 1H', colors: ['#f8e0d8', '#d8a080', '#704830', '#201010'] },
  { name: 'SGB 2H', colors: ['#f8f8f8', '#c8c8c8', '#707070', '#202020'] },
  { name: 'SGB 3H', colors: ['#e0ffd0', '#a0d880', '#509040', '#203018'] },
  { name: 'SGB 4H', colors: ['#f8f8d8', '#c8d080', '#808840', '#202810'] }
];

function rgbToHex({ r, g, b }: RGB) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
}

function normalizeColor(hex: string) {
  const clean = hex.toLowerCase();
  return clean === '#e3f8d0' ? '#e0f8d0' : clean;
}

function brightness(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return r + g + b;
}

function colorDistance(a: string, b: string) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);

  return (
    (ca.r - cb.r) ** 2 +
    (ca.g - cb.g) ** 2 +
    (ca.b - cb.b) ** 2
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load token image'));
    img.src = src;
  });
}

function getTopPalette(imageData: ImageData, limit = 4): PaletteItem[] {
  const counts = new Map<string, number>();

  for (let i = 0; i < imageData.data.length; i += 4) {
    if (imageData.data[i + 3] === 0) continue;

    const hex = normalizeColor(
      rgbToHex({
        r: imageData.data[i],
        g: imageData.data[i + 1],
        b: imageData.data[i + 2]
      })
    );

    counts.set(hex, (counts.get(hex) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([hex, count]) => ({ original: hex, replacement: hex, count }))
    .sort((a, b) => brightness(b.original) - brightness(a.original));
}

function findClosestPaletteColor(hex: string, palette: PaletteItem[]) {
  return palette.reduce((best, item) =>
    colorDistance(hex, item.original) < colorDistance(hex, best.original)
      ? item
      : best
  );
}

function recolor(source: ImageData, palette: PaletteItem[], colors: string[]) {
  const output = new ImageData(
    new Uint8ClampedArray(source.data),
    source.width,
    source.height
  );

  const replacements = new Map(
    palette.map((p, i) => [
      p.original.toLowerCase(),
      hexToRgb(colors[i] || p.replacement)
    ])
  );

  for (let i = 0; i < output.data.length; i += 4) {
    if (output.data[i + 3] === 0) continue;

    const hex = normalizeColor(
      rgbToHex({
        r: output.data[i],
        g: output.data[i + 1],
        b: output.data[i + 2]
      })
    );

    let next = replacements.get(hex);

    if (!next) {
      const closest = findClosestPaletteColor(hex, palette);
      const closestIndex = palette.findIndex((p) => p.original === closest.original);
      next = hexToRgb(colors[closestIndex] || closest.replacement);
    }

    output.data[i] = next.r;
    output.data[i + 1] = next.g;
    output.data[i + 2] = next.b;
  }

  return output;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalRef = useRef<ImageData | null>(null);
  const cacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const [tokenId, setTokenId] = useState('1');
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [palette, setPalette] = useState<PaletteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [gridMode, setGridMode] = useState<GridMode>(1);
  const [selectedCell, setSelectedCell] = useState(0);
  const [gridPalettes, setGridPalettes] = useState<number[]>([0]);
  const [customColors, setCustomColors] = useState([
    '#e0f8d0',
    '#88c070',
    '#346856',
    '#081820'
  ]);

  const cellCount = gridMode * gridMode;
  const customIndex = PRESET_PALETTES.length;

  const activeColors = useMemo(
    () => [...PRESET_PALETTES, { name: 'CUSTOM', colors: customColors }],
    [customColors]
  );

  function getCachedPaletteCanvas(index: number) {
    const source = originalRef.current;
    if (!source || palette.length === 0) return null;

    const colors = activeColors[index]?.colors || activeColors[0].colors;
    const key = `${index}-${colors.join('-')}`;

    const cached = cacheRef.current.get(key);
    if (cached) return cached;

    const imageData = recolor(source, palette, colors);

    const temp = document.createElement('canvas');
    temp.width = source.width;
    temp.height = source.height;

    const tempCtx = temp.getContext('2d');
    if (!tempCtx) return null;

    tempCtx.imageSmoothingEnabled = false;
    tempCtx.putImageData(imageData, 0, 0);

    cacheRef.current.set(key, temp);
    return temp;
  }

  function ensureGridPalettes(mode: GridMode) {
    const count = mode * mode;

    setGridPalettes((current) =>
      Array.from({ length: count }, (_, i) => current[i] ?? i % PRESET_PALETTES.length)
    );

    setSelectedCell(0);
  }

  async function fetchAndDraw() {
    setLoading(true);
    setError('');

    try {
      const meta = await fetchTokenMetadata(BigInt(tokenId));
      const img = await loadImage(meta.image);

      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas was not ready.');

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas is not supported.');

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const source = ctx.getImageData(0, 0, canvas.width, canvas.height);

      originalRef.current = source;
      cacheRef.current.clear();

      setPalette(getTopPalette(source, 4));
      setMetadata(meta);
      setGridMode(1);
      setGridPalettes([0]);
      setSelectedCell(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(index: number) {
    setGridPalettes((current) => {
      const next = [...current];
      next[selectedCell] = index;
      return next;
    });
  }

  function randomPalette() {
    setGridPalettes((current) =>
      current.map(() => Math.floor(Math.random() * PRESET_PALETTES.length))
    );
  }

  function drawCanvas() {
    const source = originalRef.current;
    const canvas = canvasRef.current;
    if (!source || !canvas || palette.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = source.width;
    const cellSize = size / gridMode;

    canvas.width = size;
    canvas.height = size;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);

    for (let cell = 0; cell < cellCount; cell++) {
      const paletteIndex = gridPalettes[cell] ?? 0;
      const sourceCanvas = getCachedPaletteCanvas(paletteIndex);
      if (!sourceCanvas) continue;

      const x = (cell % gridMode) * cellSize;
      const y = Math.floor(cell / gridMode) * cellSize;

      ctx.drawImage(
        sourceCanvas,
        0,
        0,
        source.width,
        source.height,
        x,
        y,
        cellSize,
        cellSize
      );
    }
  }

  useEffect(() => {
    cacheRef.current.clear();
  }, [palette, customColors]);

  useEffect(() => {
    drawCanvas();
  }, [palette, gridPalettes, gridMode, customColors]);

  function exportPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `florentine-${tokenId}-filter8.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return (
    <main>
      <header>
        <h1>
          Florentine Pixel Recolor{' '}
          <a href="https://x.com/0xfilter8" target="_blank" rel="noreferrer">
            by filter8
          </a>
        </h1>
      </header>

      <div className="divider" />

      <div className="topbar">
        <input
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          placeholder="TOKEN ID"
        />

        <button onClick={fetchAndDraw} disabled={loading}>
          {loading ? 'LOADING' : 'FETCH'}
        </button>

        <button onClick={randomPalette} disabled={palette.length === 0}>
          RANDOM
        </button>

        <button
          onClick={() => {
            setGridMode(1);
            ensureGridPalettes(1);
          }}
          className={gridMode === 1 ? 'activeButton' : ''}
          disabled={palette.length === 0}
        >
          1x1
        </button>

        <button
          onClick={() => {
            setGridMode(2);
            ensureGridPalettes(2);
          }}
          className={gridMode === 2 ? 'activeButton' : ''}
          disabled={palette.length === 0}
        >
          2x2
        </button>

        <button
          onClick={() => {
            setGridMode(3);
            ensureGridPalettes(3);
          }}
          className={gridMode === 3 ? 'activeButton' : ''}
          disabled={palette.length === 0}
        >
          3x3
        </button>

        <button onClick={exportPng} disabled={!metadata}>
          PNG
        </button>
      </div>

      {gridMode > 1 && (
        <div className="cellPicker">
          {Array.from({ length: cellCount }, (_, i) => (
            <button
              key={i}
              onClick={() => setSelectedCell(i)}
              className={selectedCell === i ? 'activeButton' : ''}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <section className="stage">
        <canvas
  ref={canvasRef}
  width={512}
  height={512}
  onClick={(e) => {
    if (gridMode === 1) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor((x / rect.width) * gridMode);
    const row = Math.floor((y / rect.height) * gridMode);
    const cell = row * gridMode + col;

    setSelectedCell(cell);
  }}
/>

        {metadata && (
          <div className="caption">
            <span>{metadata.name}</span>
            <span>{gridMode}x{gridMode}</span>
          </div>
        )}

        <div className="paletteGrid">
          {activeColors.map((preset, index) => (
            <button
              key={preset.name}
              className="paletteStrip"
              onClick={() => applyPreset(index)}
              disabled={palette.length === 0}
              title={preset.name}
            >
              {preset.colors.map((color, i) => (
                <span key={`${color}-${i}`} style={{ background: color }} />
              ))}
            </button>
          ))}
        </div>

        <div className="customPalette">
          <p>CUSTOM 4 COLORS</p>

          <div className="customInputs">
            {customColors.map((color, i) => (
              <input
                key={i}
                type="color"
                value={color}
                onChange={(e) => {
                  const next = [...customColors];
                  next[i] = e.target.value;
                  setCustomColors(next);
                  applyPreset(customIndex);
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <div className="divider" />

      <footer>
        <span>CC0</span>
        <a href="https://github.com/FILTER8" target="_blank" rel="noreferrer">
          FILTER8 GITHUB
        </a>
        <a href="https://theflorentines.xyz/" target="_blank" rel="noreferrer">
          THE FLORENTINES
        </a>
      </footer>

      <style jsx>{`
        @font-face {
          font-family: 'Departure Mono';
          src: url('/DepartureMono-Regular.woff') format('woff');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }

        main {
          width: min(1100px, calc(100vw - 32px));
          margin: 0 auto;
          padding: 32px 0;
          background: #101010;
          color: #f8f0df;
          font-family: 'Departure Mono', monospace;
        }

        header {
          text-align: center;
        }

        h1 {
          font-size: 24px;
          line-height: 1.4;
          margin: 0;
          font-weight: normal;
          text-transform: uppercase;
        }

        a {
          color: #88c070;
          text-decoration: none;
        }

        .divider {
          width: 100%;
          height: 1px;
          margin: 20px 0;
          background: #2a2a2a;
        }

        .topbar,
        .cellPicker {
          display: flex;
          justify-content: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        input,
        button {
          border: 0;
          background: #181818;
          color: #f8f0df;
          padding: 10px 12px;
          border-radius: 0;
          font: inherit;
          font-size: 12px;
          text-transform: uppercase;
        }

        input {
          width: 120px;
        }

        button {
          cursor: pointer;
        }

        button:hover:not(:disabled) {
          background: #242424;
        }

        button:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .activeButton {
          background: #346856;
        }

        .error {
          color: #ffb0b0;
          text-align: center;
          font-size: 12px;
        }

        .stage {
          border: 0 !important;
          background: transparent !important;
          padding: 0 !important;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }

        canvas {
          width: min(80vw, 512px);
          height: min(80vw, 512px);
          image-rendering: pixelated;
          image-rendering: crisp-edges;
          background: transparent !important;
          border: 0 !important;
          display: block;
          cursor: pointer;
        }

        .caption {
          display: flex;
          justify-content: center;
          gap: 16px;
          font-size: 12px;
          line-height: 1.6;
          text-align: center;
          opacity: 0.8;
          text-transform: uppercase;
        }

        .paletteGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, 18px);
          gap: 5px;
          max-width: 520px;
          justify-content: center;
        }

        .paletteStrip {
          width: 18px;
          height: 18px;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          grid-template-rows: repeat(2, 1fr);
          gap: 1px;
          overflow: visible;
        }

        .paletteStrip span {
          display: block;
          width: 100%;
          height: 100%;
        }

        .customPalette {
          text-align: center;
        }

        .customPalette p {
          margin: 0 0 8px;
          font-size: 11px;
          opacity: 0.75;
        }

        .customInputs {
          display: flex;
          gap: 6px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .customInputs input[type='color'] {
          width: 26px;
          height: 26px;
          padding: 0;
          border: 0;
        }

        footer {
          display: flex;
          justify-content: center;
          gap: 18px;
          flex-wrap: wrap;
          font-size: 12px;
          opacity: 0.8;
          text-transform: uppercase;
        }

        @media (max-width: 800px) {
          h1 {
            font-size: 16px;
          }

          input,
          button {
            font-size: 11px;
          }
        }
      `}</style>
    </main>
  );
}