import { Link } from "@tanstack/react-router";
import { Box, Cpu, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { catalogByKey, categoryLabel } from "@/lib/componentCatalog";

/** A part with "View in 3D" (catalog details) and "Practice in 3D Lab". */
export function PartLinks({
  partKey,
  quantity,
  previews,
}: {
  partKey: string;
  quantity?: number;
  /** Rendered 3D previews, keyed by lab model id (from usePartPreviews). */
  previews: Record<string, string>;
}) {
  const item = catalogByKey.get(partKey);
  if (!item) return null;
  const preview = previews[item.model];
  return (
    <li className="glass-inset flex flex-wrap items-center gap-3 rounded-xl p-2.5">
      <span className="grid h-11 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
        {preview ? <img src={preview} alt="" className="h-full w-full object-contain" /> : <Cpu size={18} className="text-primary" />}
      </span>
      <span className="min-w-[10rem] flex-1">
        <strong className="block text-sm">
          {quantity ? `${quantity} × ` : ""}
          {item.name}
        </strong>
        <span dir="rtl" className="block text-xs text-muted-foreground">
          {item.arabic}
        </span>
        <span className="block text-[10px] text-muted-foreground">{categoryLabel(item.category)}</span>
      </span>
      <span className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="secondary" asChild>
          <Link to="/catalog" search={{ part: item.key }}>
            <Eye size={13} /> View in 3D
          </Link>
        </Button>
        <Button size="sm" variant="secondary" asChild>
          <Link to="/lab" search={{ add: item.model, request: `${item.key}-practice` }}>
            <Box size={13} /> Practice in 3D Lab
          </Link>
        </Button>
      </span>
    </li>
  );
}
