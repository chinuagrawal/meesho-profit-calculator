import type { CSSProperties } from "react";
import { ArrowUpRight, BarChart3, LayoutDashboard, Package, Settings2, ShieldCheck } from "lucide-react";
export function ProfitPreview({ compact = false }: { compact?: boolean }) {
  return <div className={`profit-preview${compact ? " profit-preview-compact" : ""}`} aria-label="Illustrative profit dashboard with sample data">
    <div className="preview-chrome"><span className="preview-dots"><i /><i /><i /></span><span>YOUR BUSINESS, AT A GLANCE</span><span className="preview-demo">Sample data</span></div>
    <div className="preview-app"><aside className="preview-sidebar" aria-hidden="true"><span className="preview-mini-logo">m.</span><LayoutDashboard /><BarChart3 /><Package /><Settings2 /></aside>
      <div className="preview-content"><div className="preview-heading"><div><span className="preview-overline">THE BIG PICTURE</span><h3>Profit overview</h3></div><span className="preview-period">This month <span>⌄</span></span></div>
        <div className="preview-balance"><div><span>Net cash profit</span><strong>₹24,680<span>.00</span></strong></div><span className="preview-balance-icon"><ArrowUpRight size={27} /></span><p><span className="preview-positive-dot" /> After purchase costs & advertising</p></div>
        <div className="preview-chart"><div className="preview-chart-title"><span>A clearer view of progress</span><span>PROFIT</span></div><svg viewBox="0 0 420 116" role="img" aria-label="Sample upward profit trend"><defs><linearGradient id="profit-preview-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5f8b56" stopOpacity=".22" /><stop offset="100%" stopColor="#5f8b56" stopOpacity="0" /></linearGradient></defs><path d="M0 25 H420 M0 63 H420 M0 101 H420" stroke="#e9ede5" strokeDasharray="4 4" /><path d="M0 93 C22 93 24 64 49 68 S74 94 100 76 S126 89 150 60 S178 74 200 51 S225 62 249 35 S277 60 300 30 S333 44 353 19 S388 31 420 9 L420 116 L0 116Z" fill="url(#profit-preview-fill)" /><path d="M0 93 C22 93 24 64 49 68 S74 94 100 76 S126 89 150 60 S178 74 200 51 S225 62 249 35 S277 60 300 30 S333 44 353 19 S388 31 420 9" stroke="#477449" strokeWidth="3" fill="none" strokeLinecap="round" /></svg><div className="preview-chart-labels"><span>Week 1</span><span>Week 2</span><span>Week 3</span><span>Week 4</span></div></div>
        <div className="preview-metrics"><div><span>Settlement</span><strong>₹82,400</strong><i style={{"--bar-width":"88%"} as CSSProperties} /></div><div><span>Purchase costs</span><strong>₹54,800</strong><i style={{"--bar-width":"63%"} as CSSProperties} /></div><div><span>Ad spend</span><strong>₹2,920</strong><i style={{"--bar-width":"24%"} as CSSProperties} /></div></div>
      </div>
    </div>
    {!compact && <div className="preview-floating-note"><span><ShieldCheck size={20} /></span><div><strong>Your numbers. Your account.</strong><small>Saved securely, ready when you are.</small></div></div>}
  </div>;
}
