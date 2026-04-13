import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";
import Chat from "./Chat";
import * as THREE from "three";
import mountain from "./assets/mountain2.png";

/* Types */
interface ArticleNode {
  id: number;
  title: string;
  score: number;
  branch: number;
  description?: string;
}

type ScoringMode = "tfidf" | "svd";

const ALGO_LABELS: Record<ScoringMode, string> = {
  tfidf: "TF-IDF + MMR",
  svd: "SVD",
};

/* Sparkle Cursor */
interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  rotation: number;
  born: number;
}

function SparkleCursor() {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const nextId = useRef(0);
  const lastPos = useRef({ x: -999, y: -999 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      if (Math.hypot(dx, dy) < 6) return;
      lastPos.current = { x: e.clientX, y: e.clientY };

      const newSparkle: Sparkle = {
        id: nextId.current++,
        x: e.clientX,
        y: e.clientY,
        size: 18 + Math.random() * 28,
        opacity: 0.7 + Math.random() * 0.3,
        rotation: Math.random() * 360,
        born: Date.now(),
      };
      setSparkles((prev) => [...prev.slice(-28), newSparkle]);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Fade out for sparkles
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setSparkles((prev) => prev.filter((s) => now - s.born < 650));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Pastel dark-blue palette for our beautiful sparkles yay
  const colors = [
    "rgba(147,197,253,VAL)", // sky-300
    "rgba(165,180,252,VAL)", // indigo-300
    "rgba(196,181,253,VAL)", // violet-300
    "rgba(125,211,252,VAL)", // cyan-300
    "rgba(99,179,237,VAL)", // blue-400
  ];

  return (
    <div className="sparkle-layer" style={{ pointerEvents: "none" }}>
      {sparkles.map((s, i) => {
        const age = (Date.now() - s.born) / 650;
        const alpha = s.opacity * (1 - age * 0.8);
        const colorTemplate = colors[i % colors.length];
        const color = colorTemplate.replace("VAL", alpha.toFixed(2));
        const scale = 1 - age * 0.4;
        return (
          <svg
            key={s.id}
            className="sparkle-svg"
            style={{
              left: s.x,
              top: s.y,
              width: s.size * 1.3,
              height: s.size * 1.4,
              transform: `translate(-50%,-50%) rotate(${s.rotation}deg) scale(${scale})`,
              opacity: alpha,
            }}
            viewBox="0 0 24 24"
          >
            {/* 4-point star */}
            <path
              d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z"
              fill={color}
            />
          </svg>
        );
      })}
    </div>
  );
}

/* Twinkling star field layered ontop of the mountain bg */
function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight * 0.55;
    };
    resize();
    window.addEventListener("resize", resize);

    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.7,
      r: 0.5 + Math.random() * 1.8,
      phase: Math.random() * Math.PI * 2,
      speed: 0.006 + Math.random() * 0.01,
      cross: Math.random() > 0.7,
    }));

    let t = 0;
    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t++;
      stars.forEach((s) => {
        const alpha = 0.3 + 0.7 * Math.abs(Math.sin(t * s.speed + s.phase));
        const px = s.x * canvas.width;
        const py = s.y * canvas.height;
        if (s.cross) {
          // draw a 4-pointed cross star
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          const arm = s.r * 3.5;
          ctx.fillRect(-0.8, -arm, 1.6, arm * 2);
          ctx.fillRect(-arm, -0.8, arm * 2, 1.6);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(px, py, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220,235,255,${alpha})`;
          ctx.fill();
        }
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={canvasRef} className="star-canvas" />;
}

/* Three.js tunnel animation visual  */
function TunnelCanvas({ index, active }: { index: number; active: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const W = mount.clientWidth || 280;
    const H = mount.clientHeight || 460;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 100);
    camera.position.z = 2;

    const palettes = [
      { m: new THREE.Color(0x93c5fd), d: new THREE.Color(0x1e3a5f) }, // blue
      { m: new THREE.Color(0xa5b4fc), d: new THREE.Color(0x2d1b69) }, // indigo
      { m: new THREE.Color(0xc4b5fd), d: new THREE.Color(0x3b1a6b) }, // violet
    ];
    const pal = palettes[index % palettes.length];
    const col = active ? pal.m : pal.d;

    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 18; i++) {
      const geo = new THREE.TorusGeometry(1.15, 0.018, 8, 56);
      const mat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: active ? 0.6 - i * 0.022 : 0.18 - i * 0.006,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.position.z = -i * 0.6;
      scene.add(ring);
      rings.push(ring);
    }

    const pCount = 90;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.4 + Math.random() * 0.75;
      pPos[i * 3] = Math.cos(a) * r;
      pPos[i * 3 + 1] = Math.sin(a) * r;
      pPos[i * 3 + 2] = -Math.random() * 11;
    }
    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    scene.add(
      new THREE.Points(
        pgeo,
        new THREE.PointsMaterial({
          color: active ? pal.m : pal.d,
          size: 0.032,
          transparent: true,
          opacity: active ? 0.85 : 0.25,
        }),
      ),
    );

    let frame = 0;
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      frame += 0.01;
      rings.forEach((r, i) => {
        r.position.z = ((-i * 0.6 + frame * 1.1) % 11) - 11;
        r.rotation.z += 0.002 * (i % 2 === 0 ? 1 : -1);
      });
      const pos = pgeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pCount; i++) {
        (pos.array as Float32Array)[i * 3 + 2] += 0.05;
        if ((pos.array as Float32Array)[i * 3 + 2] > 2)
          (pos.array as Float32Array)[i * 3 + 2] = -11;
      }
      pos.needsUpdate = true;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement))
        mount.removeChild(renderer.domElement);
    };
  }, [index, active]);
  return <div ref={mountRef} className="tunnel-canvas" />;
}

/* Article Card */
function ArticleCard({ node, depth }: { node: ArticleNode; depth: number }) {
  const [hov, setHov] = useState(false);
  return (
    <a
      href={`https://en.wikipedia.org/wiki/${encodeURIComponent(node.title)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`article-card ${hov ? "hovered" : ""}`}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ animationDelay: `${depth * 0.1 + 0.15}s` }}
    >
      <span className="card-pip" />
      <span className="card-title">{node.title}</span>
      <span className="card-score">{node.score.toFixed(3)}</span>
      <span className="card-arrow">↗</span>
    </a>
  );
}

/* Algorithm Toggle */
function AlgoToggle({
  value,
  onChange,
}: {
  value: ScoringMode;
  onChange: (m: ScoringMode) => void;
}) {
  return (
    <div className="algo-toggle">
      {(["tfidf", "svd"] as ScoringMode[]).map((m) => (
        <button
          key={m}
          type="button"
          className={`algo-btn ${value === m ? "active" : ""}`}
          onClick={() => onChange(m)}
        >
          {ALGO_LABELS[m]}
        </button>
      ))}
    </div>
  );
}

/* Root App */
export default function App(): JSX.Element {
  const [useLlm, setUseLlm] = useState<boolean | null>(null);
  const [article, setArticle] = useState("");
  const [branches, setBranches] = useState<ArticleNode[][]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [scoringMode, setScoringMode] = useState<ScoringMode>("tfidf");
  const [numArticles, setNumArticles] = useState(5);
  const [underground, setUnderground] = useState(false);
  const [activeBranch, setActiveBranch] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setUseLlm(d.use_llm));
  }, []);

  const handleSearch = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!article.trim()) return;
      setLoading(true);
      setHasSearched(false);
      setUnderground(true);
      try {
        const res = await fetch(
          `/api/rabbithole?article=${encodeURIComponent(article)}&scoring_mode=${scoringMode}&path_length=${numArticles}`,
        );
        const data: ArticleNode[][] = await res.json();
        setBranches(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setHasSearched(true);
      }
    },
    [article, scoringMode, numArticles],
  );

  const handleSurface = () => {
    setUnderground(false);
    setBranches([]);
    setHasSearched(false);
  };

  if (useLlm === null) return <></>;

  return (
    <>
      <SparkleCursor />

      {/* The sky world, our user query page */}
      <div className={`sky-world ${underground ? "sky-exit" : ""}`}>
        {/* Mountain background image fills the whole sky */}
        <div
          className="mountain-bg"
          style={{ backgroundImage: `url(${mountain})` }}
        />

        {/* Stars rendered on top of our mountain bg to amaze amaze amaze the users :)  */}
        <StarField />

        {/* Hero */}
        <div className="hero-content">
          <p className="hero-eyebrow">Wikipedia Discovery Engine</p>
          <h1 className="hero-title">
            <span className="title-rabbit">🐇</span> Rabbit Hole
          </h1>
          <p className="hero-sub">Enter a topic. Fall down the rabbit hole.</p>

          <form className="search-form" onSubmit={handleSearch}>
            <input
              className="search-input"
              placeholder="Starting article…"
              value={article}
              onChange={(e) => setArticle(e.target.value)}
              required
            />
            <AlgoToggle value={scoringMode} onChange={setScoringMode} />
            <div className="slider-row">
              <label htmlFor="num-articles-slider" className="slider-label">
                Articles per tunnel: <strong>{numArticles}</strong>
              </label>
              <input
                id="num-articles-slider"
                type="range"
                min={2}
                max={10}
                value={numArticles}
                onChange={(e) => setNumArticles(Number(e.target.value))}
                className="slider-input"
              />
              <div className="slider-range-labels">
                <span>2</span>
                <span>10</span>
              </div>
            </div>
            <button className="dig-btn" type="submit" disabled={loading}>
              {loading ? (
                <span className="dig-dots">
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                "✦ Dig the Hole"
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Query results, aka underground world */}
      <div
        className={`underground-world ${underground ? "underground-enter" : ""}`}
      >
        <div className="dirt-bg" />

        {/* Root SVGs */}
        <svg
          className="root-svg"
          viewBox="0 0 1400 900"
          preserveAspectRatio="xMidYMid slice"
        >
          <g stroke="#4a3f6b" strokeWidth="1.2" fill="none" opacity="0.4">
            <path d="M0,60 Q180,140 140,300 Q100,460 280,620" />
            <path d="M1400,40 Q1220,120 1260,310 Q1300,500 1100,660" />
            <path d="M700,0 Q740,160 670,340 Q600,520 700,700" />
            <path d="M350,0 Q330,90 400,220 Q470,350 340,480" />
            <path d="M1050,0 Q1070,100 1000,230 Q930,360 1060,490" />
            <path d="M150,0 Q120,70 160,190 Q200,310 120,430" />
            <path d="M0,300 Q90,350 70,480 Q50,610 160,700" />
            <path d="M1400,350 Q1320,390 1340,520" />
          </g>
        </svg>

        {/* Pebbles */}
        {Array.from({ length: 25 }).map((_, i) => (
          <div
            key={i}
            className="pebble"
            style={{
              left: `${(i * 41 + 7) % 97}%`,
              top: `${(i * 53 + 12) % 90}%`,
              width: `${4 + (i % 5) * 3}px`,
              height: `${3 + (i % 4) * 2}px`,
            }}
          />
        ))}

        <div className="dirt-seam" />

        <button className="surface-btn" onClick={handleSurface}>
          ↑ Back to Surface
        </button>

        {loading && (
          <div className="ug-loading">
            <div className="shovel">⛏</div>
            <p>Digging your rabbit holes…</p>
            <div className="ug-dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        {hasSearched && !branches.length && !loading && (
          <div className="ug-empty">
            <p>🕳️ No tunnels found — try different keywords.</p>
          </div>
        )}

        {branches.length > 0 && (
          <section className="branch-section">
            <p className="branch-hint">
              {branches.length} thematic tunnels · hover to illuminate · click
              to explore
            </p>
            <div
              className="branch-grid"
              style={{ gridTemplateColumns: `repeat(${branches.length},1fr)` }}
            >
              {branches.map((branch, bi) => (
                <div
                  key={bi}
                  className={`branch-col ${activeBranch === bi ? "active" : ""}`}
                  onMouseEnter={() => setActiveBranch(bi)}
                  onMouseLeave={() => setActiveBranch(null)}
                >
                  <TunnelCanvas index={bi} active={activeBranch === bi} />
                  <div className="branch-label">Tunnel {bi + 1}</div>
                  {branch[0]?.description && (
                    <p className="branch-desc">{branch[0].description}</p>
                  )}
                  <div className="cards-stack">
                    {branch.map((node, di) => (
                      <ArticleCard key={node.id} node={node} depth={di} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {useLlm && (
          <Chat
            onSearchTerm={(val) => {
              setArticle(val);
              handleSearch();
            }}
          />
        )}
      </div>
    </>
  );
}
