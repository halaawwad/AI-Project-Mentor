import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, Box, Cpu, Menu, Minus, Package, Plus, Trash2, X } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { usePartPreviews } from "@/lib/lab/usePartPreviews";
import {
  catalogByKey,
  catalogCategories,
  categoryLabel,
  clearBom,
  readBom,
  removeFromBom,
  setBomQuantity,
  type BomEntry,
} from "@/lib/componentCatalog";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/**
 * Bill of Materials built from the catalog. LabAssist showed these entries inside its
 * project workspace (`routes/project.tsx`, components tab); AiPM lists only the parts the
 * student added, without the workshop cost/availability data that page merged in.
 */
export function BomPage() {
  useDocumentTitle("Bill of Materials | AiPM");
  const navigate = useNavigate();
  const previews = usePartPreviews();
  const [menu, setMenu] = useState(false),
    [bom, setBom] = useState<BomEntry[]>([]),
    [notice, setNotice] = useState("");
  useEffect(() => setBom(readBom()), []);
  const update = (change: () => BomEntry[], message?: string) => {
    try {
      setBom(change());
      setNotice(message ?? "");
    } catch {
      setNotice("Could not save BOM in this browser. Please enable local storage.");
    }
  };
  const rows = bom.flatMap((entry) => {
    const item = catalogByKey.get(entry.key);
    return item ? [{ entry, item }] : [];
  });
  const units = rows.reduce((sum, row) => sum + row.entry.quantity, 0);
  return (
    <div className="dashboard-background catalog-background min-h-screen">
      <div className="mx-auto flex max-w-[1800px] gap-4 p-3 lg:p-4">
        {menu && (
          <button
            onClick={() => setMenu(false)}
            aria-label="Close navigation overlay"
            className="fixed inset-0 z-30 bg-foreground/20 lg:hidden"
          />
        )}
        <AppSidebar
          active="Bill of Materials"
          open={menu}
          onClose={() => setMenu(false)}
          className="lg:sticky lg:top-4 lg:h-[calc(100vh-32px)]"
        />
        <main className="min-w-0 flex-1 space-y-4 pb-6">
          <header className="glass-panel flex flex-wrap items-center gap-3 rounded-panel p-5">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open menu"
              onClick={() => setMenu(true)}
            >
              <Menu />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="ds-kicker">
                What the build is made of
              </p>
              <div className="ds-heading mt-1">
                <h1 className="ds-title">Bill of Materials</h1>
                <p dir="rtl" lang="ar" className="ds-title">قائمة القطع</p>
              </div>
            </div>
            <span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-mint-foreground">
              {units} units · {rows.length} parts
            </span>
            <Button variant="secondary" size="sm" onClick={() => navigate({ to: "/catalog" })}>
              Explore component catalog <ArrowUpRight size={13} />
            </Button>
          </header>
          {notice && (
            <div
              role="status"
              className="catalog-notice flex items-center justify-between gap-3 rounded-xl p-3 text-xs"
            >
              <span>{notice}</span>
              <button aria-label="Dismiss message" onClick={() => setNotice("")}>
                <X size={14} />
              </button>
            </div>
          )}
          {rows.length ? (
            <section className="glass-panel rounded-panel p-4" aria-label="BOM entries">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="p-2 font-semibold">Component</th>
                      <th className="p-2 font-semibold">Category</th>
                      <th className="p-2 font-semibold">Typical supply</th>
                      <th className="p-2 font-semibold">Qty</th>
                      <th className="p-2 font-semibold">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ entry, item }) => (
                      <tr
                        key={item.key}
                        data-category-tone={catalogCategories.indexOf(item.category)}
                        className="border-t border-border"
                      >
                        <td className="p-2">
                          <div className="flex items-center gap-3">
                            <span className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
                              {previews[item.model] ? (
                                <img
                                  src={previews[item.model]}
                                  alt=""
                                  className="h-full w-full object-contain"
                                />
                              ) : (
                                <Cpu size={20} className="text-primary" />
                              )}
                            </span>
                            <span className="min-w-0">
                              <strong className="block text-sm">{item.name}</strong>
                              <span dir="rtl" className="block text-xs text-muted-foreground">
                                {item.arabic}
                              </span>
                              <span className="block font-mono text-[9px] text-muted-foreground">
                                {item.key}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="p-2 text-xs">{categoryLabel(item.category)}</td>
                        <td className="p-2 text-xs">
                          {item.voltage ? `${item.voltage} V` : "Circuit-dependent"}
                        </td>
                        <td className="p-2">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label={`Decrease ${item.name} quantity`}
                              onClick={() =>
                                update(() => setBomQuantity(item.key, entry.quantity - 1))
                              }
                            >
                              <Minus />
                            </Button>
                            <span className="w-8 text-center font-mono text-sm" aria-live="polite">
                              {entry.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label={`Increase ${item.name} quantity`}
                              onClick={() =>
                                update(() => setBomQuantity(item.key, entry.quantity + 1))
                              }
                            >
                              <Plus />
                            </Button>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button variant="ghost" size="sm" asChild>
                              <Link to="/catalog" search={{ part: item.key }}>
                                Details
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              onClick={() =>
                                navigate({
                                  to: "/lab",
                                  search: { add: item.model, request: Date.now().toString() },
                                })
                              }
                            >
                              <Box size={13} /> Open in 3D Lab
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive"
                              aria-label={`Remove ${item.name} from BOM`}
                              onClick={() =>
                                update(() => removeFromBom(item.key), `${item.name} removed`)
                              }
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <p className="text-[11px] text-muted-foreground">
                  Quantities are saved in this browser. Prices and stock are not tracked in this
                  demo.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    if (window.confirm("Remove every part from the BOM?"))
                      update(clearBom, "BOM cleared");
                  }}
                >
                  <Trash2 size={13} /> Clear BOM
                </Button>
              </div>
            </section>
          ) : (
            <section className="glass-panel rounded-panel p-10 text-center">
              <Package className="mx-auto text-primary" />
              <h2 className="mt-3 text-sm font-bold">Your BOM is empty</h2>
              <p className="mt-2 text-xs text-muted-foreground">
                Add parts from the component catalog to build your list.
              </p>
              <p dir="rtl" className="mt-1 text-xs text-muted-foreground">
                أضف القطع من كتالوج المكونات لبناء قائمتك.
              </p>
              <Button className="mt-4" onClick={() => navigate({ to: "/catalog" })}>
                <Cpu size={14} /> Open the catalog
              </Button>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
