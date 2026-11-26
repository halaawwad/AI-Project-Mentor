import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Boxes, FileSearch, ListChecks, PackagePlus } from "lucide-react";
import { JourneyLayout } from "@/components/journey/JourneyUi";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

const plannedSteps = [
  {
    icon: FileSearch,
    title: "Find official information",
    arabic: "البحث عن المعلومات الرسمية",
    text: "Look up the manufacturer's datasheet, pinout and supply limits for the exact part number.",
  },
  {
    icon: Boxes,
    title: "Find or create a 3D model",
    arabic: "إيجاد نموذج ثلاثي الأبعاد أو إنشاؤه",
    text: "Search model libraries for the part, or prepare a simple model with its pins for the 3D Lab.",
  },
  {
    icon: ListChecks,
    title: "Review and add to the catalog",
    arabic: "المراجعة والإضافة إلى الكتالوج",
    text: "Check the pins and sources, then add the part so it can be used in paths, the BOM and the lab.",
  },
];

/** Planned flow for parts that aren't in the catalog. Nothing is searched or generated yet. */
export function NewComponentPage() {
  useDocumentTitle("New component · Coming soon | AiPM");
  const [name, setName] = useState("");
  return (
    <JourneyLayout
      step="parts"
      eyebrow="PLANNED FEATURE"
      title="Add a new component"
      arabic="إضافة قطعة جديدة"
      actions={
        <span className="rounded-full bg-soft-amber px-3 py-1 text-xs font-semibold">
          Coming soon <span dir="rtl">· قريباً</span>
        </span>
      }
    >
      <section className="glass-panel rounded-[22px] p-5">
        <p className="text-sm">
          The catalog has 43 parts. For a part that isn't there yet, AiPM will guide you through this
          flow. It isn't available in this demo: nothing below searches the web or creates models.
        </p>
        <p dir="rtl" className="text-xs text-muted-foreground">
          هذه الميزة قيد التطوير ولا تبحث عن أي نتائج في هذه النسخة التجريبية.
        </p>
        <label htmlFor="new-part" className="mt-4 block text-xs font-semibold">
          Part name or number
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            id="new-part"
            dir="auto"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. HX711 load cell amplifier"
            className="h-9 min-w-64 flex-1 rounded-md border border-border bg-card px-3 text-sm"
          />
          <Button disabled title="Coming soon">
            <PackagePlus size={15} /> Search · Coming soon
          </Button>
        </div>
      </section>
      <ol className="grid gap-4 md:grid-cols-3">
        {plannedSteps.map(({ icon: Icon, title, arabic, text }, i) => (
          <li key={title} className="glass-panel rounded-[22px] p-5 opacity-80">
            <span className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground">
              STEP {i + 1} · COMING SOON
            </span>
            <h2 className="mt-2 flex items-center gap-2 text-sm font-bold">
              <Icon size={16} /> {title}
            </h2>
            <p dir="rtl" className="text-xs text-muted-foreground">
              {arabic}
            </p>
            <p className="mt-2 text-sm">{text}</p>
            <p className="mt-3 rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
              No results — this step isn't built yet.
            </p>
          </li>
        ))}
      </ol>
      <Button variant="secondary" asChild>
        <Link to="/catalog">Browse the existing catalog</Link>
      </Button>
    </JourneyLayout>
  );
}
