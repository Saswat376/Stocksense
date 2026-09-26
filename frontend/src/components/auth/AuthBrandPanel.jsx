/**
 * Shared brand sidebar shown on the left of all auth pages.
 */
export default function AuthBrandPanel() {
  return (
    <div className="auth-brand">
      <div className="auth-brand-logo">
        <div className="auth-brand-icon">
          {/* S logo mark */}
          <svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 7H11C9.343 7 8 8.343 8 10s1.343 3 3 3h6c3.314 0 6 2.686 6 6s-2.686 6-6 6H8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
          </svg>
        </div>
        <div>
          <div className="auth-brand-name">StockSense</div>
          <div className="auth-brand-tagline">Inventory Management</div>
        </div>
      </div>

      {/* Animated stock chart */}
      <div className="auth-chart">
        <svg viewBox="0 0 380 200" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#00d084" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#00d084" stopOpacity="0"    />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[40, 80, 120, 160].map((y) => (
            <line key={y} x1="0" y1={y} x2="380" y2={y}
              stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          ))}

          {/* Area fill */}
          <path className="chart-area"
            d="M0,160 L40,140 L80,155 L120,120 L160,100 L200,115 L240,75 L280,85 L320,55 L360,40 L380,35 L380,200 L0,200 Z" />

          {/* Line */}
          <path className="chart-line"
            d="M0,160 L40,140 L80,155 L120,120 L160,100 L200,115 L240,75 L280,85 L320,55 L360,40 L380,35" />

          {/* Dots */}
          {[
            [0,160],[80,155],[160,100],[240,75],[320,55],[380,35]
          ].map(([cx, cy], i) => (
            <circle key={i} className="chart-dot" cx={cx} cy={cy} r="4"
              style={{ animationDelay: `${1.8 + i * 0.15}s` }} />
          ))}
        </svg>
      </div>

      <div className="auth-brand-copy">
        <h2>Real-time Inventory Intelligence</h2>
        <p>Track stock levels, movements, and analytics<br />across all your warehouses in one place.</p>
      </div>
    </div>
  );
}
