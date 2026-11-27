import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Zap,
  Box,
  Check,
  ChevronDown,
  CircuitBoard,
  Cpu,
  Filter,
  Menu,
  Package,
  Search,
  X,
} from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { CatalogCategoryShowcase } from "@/components/CatalogCategoryShowcase";
import { ComponentConnectionSheet } from "@/components/ComponentConnectionSheet";
import { ComponentPreview } from "@/components/ComponentPreview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePartPreviews } from "@/lib/lab/usePartPreviews";
import {
  addToBom,
  readBom,
  catalogByKey,
  componentCatalog,
  catalogCategories,
  categoryLabel,
  customCatalogComponent,
  type CatalogComponent,
  type BomEntry,
} from "@/lib/componentCatalog";
import { deleteCustomPart, useCustomParts } from "@/lib/lab/customParts";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/**
 * Component catalog. Migrated from LabAssist `routes/catalog-preview.tsx`, the fully local
 * variant of `routes/catalog.tsx` (whose library and details need the authenticated API).
 */
export function CatalogPage() {
  useDocumentTitle("Component Catalog | AiPM");
  const navigate = useNavigate();
  const search = useSearch({ from: "/catalog" });
  const customParts = useCustomParts();
  const allItems = useMemo(
    () => [...componentCatalog, ...customParts.map(customCatalogComponent)],
    [customParts],
  );
  const previews = usePartPreviews();
  const [menu, setMenu] = useState(false),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [voltage, setVoltage] = useState("All");

  const [spotlightKey, setSpotlightKey] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const browseLibrary = () => {
    setLibraryOpen(true);
    requestAnimationFrame(() =>
      document.getElementById("catalog-library-toggle")?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "start",
      }),
    );
  };
  const showOnBench = (item: CatalogComponent) => {
    setCategory(item.category);
    setSpotlightKey(item.key);
    requestAnimationFrame(() => {
      const bench = document.getElementById("catalog-workbench");
      bench?.focus({ preventScroll: true });
      bench?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "start",
      });
    });
  };
  const [selected, setSelected] = useState<CatalogComponent | null>(null),
    [bom, setBom] = useState<BomEntry[]>([]),
    [notice, setNotice] = useState("");
  useEffect(() => setBom(readBom()), []);
  // `?part=<catalog key>` opens that part's details (used by the BOM and home screens).
  useEffect(() => {
    if (!search.part) return;
    const item = allItems.find((entry) => entry.key === search.part) ?? catalogByKey.get(search.part);
    if (item) {
      setSelected(item);
      setCategory(item.category);
      setSpotlightKey(item.key);
    } else setNotice(`No catalog part matches "${search.part}".`);
  }, [search.part, allItems]);
  const closeDetails = () => {
    setSelected(null);
    if (search.part) void navigate({ to: "/catalog", search: {}, replace: true });
  };
  const normalized = query.trim().toLowerCase().normalize("NFKC").replace(/[أإآ]/g, "ا");
  const items = allItems.filter(
    (item) =>
      (category === "All" || item.category === category) &&
      (voltage === "All" || item.voltage === Number(voltage)) &&
      `${item.name} ${item.arabic} ${item.key} ${item.model}`
        .toLowerCase()
        .normalize("NFKC")
        .replace(/[أإآ]/g, "ا")
        .includes(normalized),
  );
  const add = (item: CatalogComponent) => {
    if (item.custom) return;
    try {
      setBom(addToBom(item.key));
      setNotice(`${item.name} added to BOM`);
    } catch {
      setNotice("Could not save BOM in this browser. Please enable local storage.");
    }
  };
  const openLab = (item: CatalogComponent) =>
    navigate({ to: "/lab", search: { add: item.model, request: Date.now().toString() } });
  const removeCustom = (item: CatalogComponent) => {
    if (!item.custom || !window.confirm(`Remove ${item.name} from My parts? Saved lab projects using it may no longer load.`))
      return;
    try {
      deleteCustomPart(item.key);
      setSelected(null);
      setNotice(`${item.name} removed from My parts.`);
    } catch {
      setNotice("Could not remove this part. Check the local storage notice and try again.");
    }
  };
  const cardsRef = useRef<HTMLDivElement>(null);
  const resultKey = items.map((item) => item.key).join("|");
  useEffect(() => {
    const grid = cardsRef.current;
    if (!grid) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const cards = Array.from(grid.querySelectorAll<HTMLElement>(".catalog-library-card"));
    const revealAll = () =>
      cards.forEach((card) => {
        card.classList.remove("bubble-waiting");
        card.classList.add("bubble-arrived");
      });
    if (
      !window.IntersectionObserver ||
      media.matches ||
      document.documentElement.dataset["workspaceMotion"] === "off"
    ) {
      revealAll();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove("bubble-waiting");
            entry.target.classList.add("bubble-arrived");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.06, rootMargin: "0px 0px -18px 0px" },
    );
    cards.forEach((card, index) => {
      if (card.classList.contains("bubble-arrived")) return;
      card.style.setProperty("--bubble-delay", `${(index % 3) * 75}ms`);
      card.style.setProperty("--bubble-lean", `${index % 2 ? 1.5 : -1.5}deg`);
      card.classList.add("bubble-waiting");
      observer.observe(card);
    });
    const reduced = () => {
      if (media.matches) {
        observer.disconnect();
        revealAll();
      }
    };
    media.addEventListener("change", reduced);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", reduced);
    };
  }, [resultKey, libraryOpen]);
  const total = allItems.length;
  return (
    <div className="dashboard-background catalog-background catalog-sheet-preview min-h-screen">
      <div className="mx-auto flex max-w-[1800px] gap-4 p-3 lg:p-4">
        {menu && (
          <button
            onClick={() => setMenu(false)}
            aria-label="Close navigation overlay"
            className="fixed inset-0 z-30 bg-foreground/20 lg:hidden"
          />
        )}
        <AppSidebar
          active="Component Catalog"
          open={menu}
          onClose={() => setMenu(false)}
          className="lg:sticky lg:top-4 lg:h-[calc(100vh-32px)]"
        />
        <main
          className={`catalog-page-main min-w-0 flex-1 space-y-4 pb-6 ${libraryOpen ? "catalog-library-open" : ""}`}
        >
          <div id="catalog-workbench" tabIndex={-1} className="catalog-bench-anchor">
            <h1 className="sr-only">Component Catalog</h1>
            <CatalogCategoryShowcase
              category={category}
              onCategory={setCategory}
              previews={previews}
              totalParts={total}
              onDetails={setSelected}
              onAdd={add}
              onLab={openLab}
              spotlightKey={spotlightKey}
              onSpotlight={showOnBench}
              onBrowse={browseLibrary}
              actions={
                <>
                  <button
                    onClick={() => setMenu(true)}
                    aria-label="Open menu"
                    className="catalog-workbench-menu lg:hidden"
                  >
                    <Menu size={16} />
                  </button>
                  <Link to="/bom">
                    <Package size={13} />
                    View BOM <b>{bom.reduce((sum, item) => sum + item.quantity, 0)}</b>
                  </Link>
                </>
              }
            />
          </div>
          {notice && (
            <div
              role="status"
              className="catalog-notice mb-3 flex items-center justify-between gap-3 rounded-xl p-3 text-xs"
            >
              <span>{notice}</span>
              <button aria-label="Dismiss message" onClick={() => setNotice("")}>
                <X size={14} />
              </button>
            </div>
          )}
          <button
            id="catalog-library-toggle"
            className="catalog-library-toggle"
            aria-expanded={libraryOpen}
            aria-controls="catalog-library"
            onClick={() => setLibraryOpen((open) => !open)}
          >
            <span className="catalog-library-toggle-icon">
              <Package size={20} />
            </span>
            <span>
              <strong>{libraryOpen ? "Hide component library" : "Browse all components"}</strong>
              <small>
                {libraryOpen
                  ? "Close the library and return to your workbench"
                  : `Open the library · ${total} components`}
              </small>
            </span>
            <ChevronDown size={19} />
          </button>
          {libraryOpen && (
            <section
              id="catalog-library"
              className="catalog-flow-library"
              aria-label="Component library"
            >
              <div className="catalog-library-search">
                <Search size={18} />
                <input
                  aria-label="Search components"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find a part · English / عربي"
                />
                {query && (
                  <button aria-label="Clear search" onClick={() => setQuery("")}>
                    <X size={16} />
                  </button>
                )}
                <span>{items.length} components</span>
              </div>
              <div className="grid gap-4 xl:grid-cols-[190px_1fr]">
                <aside className="glass-panel catalog-filter-panel h-fit rounded-panel p-4 xl:sticky xl:top-4">
                  <h2 className="mb-4 flex items-center gap-2 text-xs font-bold">
                    <Filter size={15} />
                    Filter Components
                  </h2>
                  <div
                    className="catalog-category-filters"
                    role="group"
                    aria-label="Component categories"
                  >
                    <button
                      className="catalog-category-choice"
                      aria-pressed={category === "All"}
                      onClick={() => setCategory("All")}
                    >
                      <span className="catalog-category-dot" />
                      All categories<strong>{total}</strong>
                    </button>
                    {catalogCategories.map((name, index) => (
                      <button
                        key={name}
                        data-category-tone={index}
                        className="catalog-category-choice"
                        aria-pressed={category === name}
                        onClick={() => setCategory(name)}
                      >
                        <span className="catalog-category-dot" />
                        <span>{categoryLabel(name)}</span>
                        <strong>
                          {allItems.filter((item) => item.category === name).length}
                        </strong>
                      </button>
                    ))}
                  </div>
                  <p className="mb-2 mt-5 text-[11px] font-semibold">Typical supply voltage</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["All", "3.3", "5", "12"].map((value) => (
                      <button
                        key={value}
                        aria-pressed={voltage === value}
                        onClick={() => setVoltage(value)}
                        className={`catalog-filter rounded-lg px-2.5 py-2 text-xs ${voltage === value ? "catalog-filter-active" : ""}`}
                      >
                        {value === "All" ? "All" : `${value}V`}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-4 w-full text-xs"
                    onClick={() => {
                      setCategory("All");
                      setVoltage("All");
                      setQuery("");
                    }}
                  >
                    Clear Filters
                  </Button>
                  <p className="mt-4 border-t border-border/50 pt-3 text-[10px] leading-5 text-muted-foreground">
                    Supply voltage depends on the board variant. Check pin voltage before wiring;
                    supply and logic voltage can differ.
                  </p>
                </aside>
                <div id="catalog-results" className="catalog-results">
                  <div className="mb-3 flex items-center justify-between text-xs">
                    <p>
                      <strong>{items.length}</strong>
                      <span className="text-muted-foreground"> of {total} components</span>
                    </p>
                    <span className="text-[10px] text-primary">Technical library</span>
                  </div>
                  <div
                    ref={cardsRef}
                    className="catalog-library-grid catalog-bubble-grid grid gap-4 sm:grid-cols-2 2xl:grid-cols-3"
                  >
                    {items.map((item) => (
                      <article
                        key={item.key}
                        data-category-tone={catalogCategories.indexOf(item.category)}
                        className="glass-panel catalog-card catalog-library-card flex min-w-0 flex-col rounded-panel p-4"
                      >
                        <button
                          aria-label={`Show ${item.name} on workbench`}
                          onClick={() => showOnBench(item)}
                          className="catalog-image flex h-44 items-center justify-center rounded-2xl"
                        >
                          {previews[item.model] ? (
                            <img
                              src={previews[item.model]}
                              alt={item.name}
                              loading="lazy"
                              className="h-36 w-full object-contain"
                            />
                          ) : (
                            <Cpu size={42} className="text-primary" />
                          )}
                          <span className="catalog-preview-label">Bring to workbench ↗</span>
                        </button>
                        <div className="catalog-card-info mt-3 flex-1">
                          <span className="catalog-category">{categoryLabel(item.category)}</span>
                          <h2 className="mt-2 text-left text-sm font-bold leading-6">
                            {item.name}
                          </h2>
                          <p dir="rtl" className="text-xs">
                            {item.arabic}
                          </p>
                          <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                            {item.key}
                          </p>
                          {item.custom && (
                            <span className="mt-2 inline-flex w-fit rounded-full bg-soft-amber px-2 py-1 text-[10px] font-semibold">
                              AI-generated part — verify with the datasheet
                            </span>
                          )}
                          <div className="catalog-tech-chips">
                            <span>
                              <Zap size={12} />
                              {item.custom && item.spec
                                ? `${item.spec.operatingVoltage.min}–${item.spec.operatingVoltage.max}V range`
                                : item.voltage ? `${item.voltage}V supply` : "Circuit-dependent"}
                            </span>
                            <span>
                              <CircuitBoard size={12} />
                              {item.def.pins.length} pins
                            </span>
                          </div>
                        </div>
                        <div className="catalog-card-footer">
                          <button className="catalog-to-bench" onClick={() => showOnBench(item)}>
                            <CircuitBoard size={13} />
                            Show on workbench <span aria-hidden="true">↗</span>
                          </button>
                          <button
                            onClick={() => setSelected(item)}
                            className="catalog-specifications"
                          >
                            View specifications <span aria-hidden="true">→</span>
                          </button>
                          {item.custom ? (
                            <div className="grid grid-cols-2 gap-2">
                              <Button size="sm" className="px-1.5 text-[10px]" onClick={() => openLab(item)}>
                                <Box size={13} />
                                Add to 3D Lab
                              </Button>
                              <Button size="sm" variant="ghost" className="px-1.5 text-[10px]" onClick={() => removeCustom(item)}>
                                <X size={13} />
                                Remove
                              </Button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="px-1.5 text-[10px]"
                                onClick={() => add(item)}
                              >
                                {bom.some((entry) => entry.key === item.key) ? (
                                  <Check size={13} />
                                ) : (
                                  <Package size={13} />
                                )}
                                Add to BOM
                              </Button>
                              <Button
                                size="sm"
                                className="px-1.5 text-[10px]"
                                onClick={() => openLab(item)}
                              >
                                <Box size={13} />
                                Add to 3D Lab
                              </Button>
                            </div>
                          )}
                        </div>
                        {!item.custom && <ComponentConnectionSheet item={item} />}
                      </article>
                    ))}
                  </div>
                  {!items.length && (
                    <div className="glass-panel rounded-2xl p-10 text-center">
                      <Search className="mx-auto text-primary" />
                      <h2 className="mt-3 text-sm font-bold">No matching components</h2>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Try another name or clear the filters.
                      </p>
                      <Button
                        className="mt-4"
                        variant="secondary"
                        onClick={() => {
                          setQuery("");
                          setCategory("All");
                          setVoltage("All");
                        }}
                      >
                        Clear Filters
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </main>
        <Dialog open={!!selected} onOpenChange={(open) => !open && closeDetails()}>
          <DialogContent
            data-category-tone={selected ? catalogCategories.indexOf(selected.category) : undefined}
            className="glass-panel glass-strong catalog-details sheet-preview-details max-h-[90vh] overflow-y-auto"
          >
            <DialogHeader>
              <DialogTitle>{selected?.name}</DialogTitle>
              <DialogDescription dir="rtl">{selected?.arabic}</DialogDescription>
            </DialogHeader>
            {selected && (
              <>
                <span className="catalog-category catalog-detail-category">
                  {categoryLabel(selected.category)}
                </span>
                {selected.custom && (
                  <span className="inline-flex w-fit rounded-full bg-soft-amber px-2.5 py-1 text-[10px] font-semibold">
                    AI-generated part — verify with the datasheet
                  </span>
                )}
                <ComponentPreview model={selected.model} />
                <p dir="rtl" className="text-sm leading-7">
                  {selected.description}
                </p>
                <div className="glass-inset grid grid-cols-2 gap-3 rounded-xl p-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Typical supply</p>
                    <strong>
                      {selected.custom && selected.spec
                        ? `${selected.spec.operatingVoltage.min}–${selected.spec.operatingVoltage.max} V`
                        : selected.voltage ? `${selected.voltage} V` : "Circuit-dependent"}
                    </strong>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Catalog current estimate</p>
                    <strong>
                      {selected.def.draw ? `${selected.def.draw} mA` : "Load-dependent"}
                    </strong>
                  </div>
                </div>
                {!selected.custom && <ComponentConnectionSheet key={selected.key} item={selected} expanded />}
                <section>
                  <h3 className="text-xs font-bold">Pins · {selected.def.pins.length}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.def.pins.map((pin, i) => (
                      <span
                        key={i}
                        title={pin.functions}
                        className="glass-inset rounded-md px-2 py-1 font-mono text-[10px]"
                      >
                        {pin.name}
                        {pin.voltage !== undefined ? ` · ${pin.voltage}V` : ""}
                      </span>
                    ))}
                  </div>
                </section>
                <section className="catalog-notice rounded-xl p-3">
                  <h3 className="text-xs font-bold">Compatibility notes</h3>
                  <p className="mt-2 text-xs leading-6">
                    Connect a common ground and match signal voltage to your controller. Motors and
                    relays need appropriate driver circuitry. Current estimates depend on load and
                    board variant.
                  </p>
                  {["raspberry_pi_4", "water_pump_5v"].includes(selected.key) && (
                    <p className="mt-2 text-xs leading-6">
                      The 3D preview uses the existing {selected.def.name} model as a visual
                      reference. Its lab specifications differ from this catalog entry; verify the
                      component variant before wiring.
                    </p>
                  )}
                </section>
                <div className="flex flex-wrap gap-2">
                  {!selected.custom && (
                    <Button variant="secondary" onClick={() => add(selected)}>
                      <Package size={15} />
                      Add to BOM
                    </Button>
                  )}
                  <Button onClick={() => openLab(selected)}>
                    <Box size={15} />
                    Add to 3D Lab
                  </Button>
                  {selected.custom && (
                    <Button variant="ghost" onClick={() => removeCustom(selected)}>
                      <X size={15} />
                      Remove from My parts
                    </Button>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
