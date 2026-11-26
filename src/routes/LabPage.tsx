import { Link, useSearch } from "@tanstack/react-router";
import { Cpu, House, Package } from "lucide-react";
import { HardwareLab } from "@/components/lab/HardwareLab";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/** 3D virtual hardware lab, migrated from LabAssist `routes/lab.tsx`. */
export function LabPage() {
  useDocumentTitle("3D Virtual Hardware Lab · AiPM");
  const search = useSearch({ from: "/lab" });
  const link =
    "inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-lg hover:bg-accent";
  return (
    <div className="lab-page-theme relative">
      <HardwareLab addComponent={search.add} addRequest={search.request} />
      <nav
        aria-label="AiPM navigation"
        className="fixed bottom-4 right-[336px] z-50 flex gap-2 max-[1100px]:right-4"
      >
        <Link to="/" className={link}>
          <House className="size-4" /> Home
        </Link>
        <Link to="/catalog" className={link}>
          <Cpu className="size-4" /> Catalog
        </Link>
        <Link to="/bom" className={link}>
          <Package className="size-4" /> BOM
        </Link>
      </nav>
    </div>
  );
}
