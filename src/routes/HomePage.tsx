import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Box,
  Compass,
  Cpu,
  GraduationCap,
  Lightbulb,
  Menu,
  Package,
  Sparkles,
} from "lucide-react";
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
          <section className="glass-panel glass-strong rounded-[28px] p-6 lg:p-10">
            <div className="flex items-start justify-between gap-3">
              <AipmBrand size={22} />
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open menu"
                onClick={() => setMenu(true)}
              >
                <Menu />
              </Button>
            </div>
            <p className="mt-8 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
              AI PROJECT MENTOR
            </p>
            <h1 className="mt-2 max-w-3xl text-3xl font-bold leading-tight lg:text-5xl">
              Learn electronics through your own project.
            </h1>
            <p dir="rtl" className="mt-3 max-w-3xl text-lg text-muted-foreground">
              تعلّم الإلكترونيات من خلال مشروعك أنت.
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <Link
                to="/describe"
                className="group flex items-center gap-4 rounded-[20px] bg-primary p-5 text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5"
              >
                <Lightbulb size={30} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <strong className="block text-lg">I have a project idea</strong>
                  <span dir="rtl" className="block text-sm opacity-90">
                    لدي فكرة مشروع
                  </span>
                  <span className="mt-1 block text-xs opacity-90">
                    Describe it, review the suggested parts, then follow your learning path.
                  </span>
                </span>
                <ArrowRight className="shrink-0 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/journey/choose"
                className="glass-inset group flex items-center gap-4 rounded-[20px] p-5 transition-transform hover:-translate-y-0.5"
              >
                <Compass size={30} className="shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <strong className="block text-lg">I don't have an idea yet</strong>
                  <span dir="rtl" className="block text-sm text-muted-foreground">
                    ليس لدي فكرة بعد
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Start with a learning project: traffic light, then parking sensor.
                  </span>
                </span>
                <ArrowRight className="shrink-0 transition-transform group-hover:translate-x-1" />
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
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {cards.map(({ to, icon: Icon, title, arabic, text, meta }) => (
              <Link
                key={to}
                to={to}
                className="glass-panel group flex flex-col rounded-[22px] p-5 transition-transform hover:-translate-y-0.5"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-mint text-mint-foreground">
                  <Icon size={20} />
                </span>
                <h2 className="mt-4 text-base font-bold">{title}</h2>
                <p dir="rtl" className="text-xs text-muted-foreground">
                  {arabic}
                </p>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{text}</p>
                <span className="mt-4 flex items-center justify-between text-xs font-semibold text-primary">
                  {meta}
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
          <section className="glass-panel rounded-[22px] p-5">
            <h2 className="text-sm font-bold">Demo flow</h2>
            <ol className="mt-3 grid gap-3 md:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step} className="glass-inset flex gap-3 rounded-xl p-3 text-sm">
                  <span className="font-mono text-xs font-bold text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
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
