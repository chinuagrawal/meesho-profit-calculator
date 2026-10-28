import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
export function MarketingBrand({ light = false }: { light?: boolean }) {
  return <Link to="/" className={`marketing-brand${light ? " marketing-brand-light" : ""}`} aria-label="Meesho Profit Calculator home">
    <span className="marketing-brand-mark"><span /><span /><span /><ArrowUpRight size={15} strokeWidth={2.5} /></span>
    <span className="marketing-brand-type">meesho<span>profit calculator</span></span>
  </Link>;
}
