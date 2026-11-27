import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Box, Compass, Cpu, GraduationCap, Lightbulb, Menu, Package, Sparkles } from "lucide-react";
import { AipmBrand } from "@/components/AipmBrand";
import { AppSidebar } from "@/components/AppSidebar";
import { ResetDemoButton } from "@/components/journey/JourneyUi";
import { Button } from "@/components/ui/button";
import { componentCatalog, readBom } from "@/lib/componentCatalog";
import { useJourney } from "@/lib/journey/store";
import { aiConfigured } from "@/lib/suggest";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/** Minimal AiPM home: connects the catalog, BOM and 3D lab into one demo flow. */
export function HomePage() {
  useDocumentTitle("AiPM · AI Project Mentor");
  const journey = useJourney();
  const [menu, setMenu] = useState(false),
    [units, setUnits] = useState(0);
  // Re-read after journey changes too, so "Reset demo" (which clears the BOM) updates the count.
  useEffect(() => setUnits(readBom().reduce((sum, entry) => sum + entry.quantity, 0)), [journey]);
  const cards = [
    {
      to: "/describe",
      icon: Sparkles,
      title: "Describe your project",
      arabic: "صف مشروعك",
      text: "Describe what you want to build and get a parts list from the catalog to review, edit and approve into your BOM.",
      meta: aiConfigured() ? "AI suggestions (Gemini)" : "Demo suggestions (local)",
    },
    {
      to: "/catalog",
      icon: Cpu,
      title: "Component Catalog",
      arabic: "كتالوج المكونات",
      text: `Explore ${componentCatalog.length} parts with 3D previews, pin maps, connection sheets and original datasheet links.`,
      meta: `${componentCatalog.length} components`,
    },
    {
      to: "/bom",
      icon: Package,
      title: "Bill of Materials",
      arabic: "قائمة القطع",
      text: "Collect the parts your project needs and adjust quantities. Saved in this browser.",
      meta: `${units} units in your BOM`,
    },
    {
      to: "/lab",
      icon: Box,
      title: "3D Hardware Lab",
      arabic: "المختبر ثلاثي الأبعاد",
      text: "Place parts, wire pins and run rule-based wiring checks for power, ground, pin types and shorts.",
      meta: "Circuits saved locally",
    },
  ] as const;
  // Dividers between the four tools: stacked on mobile, 2 × 2 from md, one row from 2xl.
  const toolBorders = [
    "",
    "border-t md:border-t-0 md:border-s",
    "border-t 2xl:border-t-0 2xl:border-s",
    "border-t md:border-s 2xl:border-t-0",
  ];
  const steps = [
    "Describe your idea (or pick a learning project) and approve the parts list.",
    "Take a quick level check, then follow the learning path: lesson, 3D parts, practice, quiz.",
    "Pass each stage's quiz to unlock the next, until you're ready to build your project.",
  ];
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
          active="Home"
          open={menu}
          onClose={() => setMenu(false)}
          className="lg:sticky lg:top-4 lg:h-[calc(100vh-32px)]"
        />
        <main className="min-w-0 flex-1 space-y-4 pb-6">
          <section className="ds-hero glass-panel rounded-panel px-6 pb-7 pt-6 lg:px-12 lg:pb-12 lg:pt-9">
            <div className="flex items-start justify-between gap-3 lg:hidden">
              <AipmBrand size={20} />
              <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setMenu(true)}>
                <Menu />
              </Button>
            </div>
            <div className="ds-bilingual mt-8 lg:mt-14">
              <h1 className="ds-display max-w-[13ch] text-[clamp(2.25rem,4.6vw,4rem)]">
                Learn electronics through your own project.
              </h1>
              <span className="ds-bilingual-rail" aria-hidden="true" />
              <p dir="rtl" lang="ar" className="ds-display justify-self-end text-[clamp(2rem,4vw,3.5rem)]">
                تعلّم الإلكترونيات من خلال مشروعك أنت.
              </p>
            </div>
            <div className="mt-10 grid gap-3 md:grid-cols-2 lg:mt-14">
              <Link
                to="/describe"
                className="group flex items-start gap-4 rounded-lg bg-primary p-5 text-primary-foreground transition-colors hover:bg-[var(--solder-deep)]"
              >
                <Lightbulb size={26} strokeWidth={1.8} className="mt-0.5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="ds-heading">
                    <strong className="text-lg font-semibold">I have a project idea</strong>
                    <span dir="rtl" lang="ar" className="text-base !text-primary-foreground/85">
                      لدي فكرة مشروع
                    </span>
                  </span>
                  <span className="mt-1.5 block text-sm text-primary-foreground/85">
                    Describe it, review the suggested parts, then follow your learning path.
                  </span>
                </span>
              </Link>
              <Link
                to="/journey/choose"
                className="group flex items-start gap-4 rounded-lg border border-[var(--line-strong)] bg-card p-5 transition-colors hover:border-primary hover:bg-secondary/50"
              >
                <Compass size={26} strokeWidth={1.8} className="mt-0.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="ds-heading">
                    <strong className="text-lg font-semibold">I don't have an idea yet</strong>
                    <span dir="rtl" lang="ar" className="text-base">
                      ليس لدي فكرة بعد
                    </span>
                  </span>
                  <span className="mt-1.5 block text-sm text-muted-foreground">
                    Start with a learning project: traffic light, then parking sensor.
                  </span>
                </span>
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {journey.project && (
                <Button variant="secondary" asChild>
                  <Link to="/journey">
                    <GraduationCap size={15} /> Continue my journey: {journey.project.title.en}
                  </Link>
                </Button>
              )}
              <ResetDemoButton />
            </div>
          </section>
          <nav
            aria-label="Tools"
            className="glass-panel grid overflow-hidden rounded-panel md:grid-cols-2 2xl:grid-cols-4"
          >
            {cards.map(({ to, icon: Icon, title, arabic, text, meta }, index) => (
              <Link
                key={to}
                to={to}
                className={`group flex flex-col border-border p-5 transition-colors hover:bg-secondary/40 lg:p-6 ${toolBorders[index]}`}
              >
                <Icon size={22} strokeWidth={1.8} className="text-primary" aria-hidden="true" />
                <span className="ds-heading mt-4">
                  <h2 className="text-base font-semibold">{title}</h2>
                  <span dir="rtl" lang="ar" className="text-sm">
                    {arabic}
                  </span>
                </span>
                <p className="mt-2 max-w-[46ch] flex-1 text-sm leading-6 text-muted-foreground">{text}</p>
                <span className="mt-4 text-[13px] font-medium text-[var(--solder-ink)] group-hover:underline group-hover:underline-offset-4">
                  {meta}
                </span>
              </Link>
            ))}
          </nav>
          <section className="glass-panel rounded-panel p-5 lg:p-6">
            <div className="ds-heading">
              <h2 className="text-base font-semibold">Demo flow</h2>
              <span dir="rtl" lang="ar" className="text-sm">
                خطوات العرض
              </span>
            </div>
            <ol className="mt-4 grid gap-3 md:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-3 border-t-2 border-[var(--line-strong)] pt-3 text-sm leading-6">
                  <span
                    aria-hidden="true"
                    className="grid size-6 shrink-0 place-items-center rounded-[4px] bg-foreground text-xs font-semibold tabular-nums text-card"
                  >
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="mt-5 max-w-[95ch] text-xs leading-5 text-muted-foreground">
              Only part suggestions use AI (Gemini, when an API key is configured; otherwise a local
              demo engine). Learning paths, quizzes and mentor feedback are prewritten demo content,
              or generated from catalog data, and are graded in your browser. Wiring checks are
              rule-based; they do not simulate electrical behaviour or run code.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
