import { useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Check, Menu, RotateCcw, UserRound } from "lucide-react";
import { AppSidebar, type AppSection } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { journeySteps, type JourneyStepId } from "@/lib/journey/path";
import { LanguageToggle } from "@/components/journey/Personalization";
import { LEARNERS, resetDemo, switchLearner, useActiveLearner, useJourney } from "@/lib/journey/store";

/** Demo control: two learners with separate journeys, to show that quizzes differ per student. */
export function LearnerSwitch() {
  const active = useActiveLearner();
  return (
    <div role="group" aria-label="Demo learner" className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-0.5">
      <UserRound size={13} className="ms-2 text-muted-foreground" aria-hidden="true" />
      {LEARNERS.map((learner) => (
        <button
          key={learner.id}
          aria-pressed={active === learner.id}
          onClick={() => switchLearner(learner.id)}
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${active === learner.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
        >
          {learner.en} <span dir="rtl">· {learner.ar}</span>
        </button>
      ))}
    </div>
  );
}

/** Idea → Parts → Level → Learning path → Quizzes → Ready, with the current step highlighted. */
export function JourneyIndicator({ current }: { current: JourneyStepId }) {
  const index = journeySteps.findIndex((step) => step.id === current);
  return (
    <nav aria-label="Journey progress" className="glass-panel rounded-[18px] px-4 py-3">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
        {journeySteps.map((step, i) => {
          const state = i < index ? "done" : i === index ? "current" : "todo";
          return (
            <li key={step.id} className="flex items-center gap-1" aria-current={state === "current" ? "step" : undefined}>
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  state === "current"
                    ? "bg-primary text-primary-foreground"
                    : state === "done"
                      ? "bg-mint text-mint-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {state === "done" ? <Check size={11} /> : <span className="font-mono">{i + 1}</span>}
                {step.en}
                <span dir="rtl" className="font-normal opacity-80">
                  · {step.ar}
                </span>
              </span>
              {i < journeySteps.length - 1 && <span className="text-muted-foreground" aria-hidden="true">→</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Honest label for prewritten or generated learning content. */
export function DemoBadge({ generated = false }: { generated?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
      {generated ? "Generated from catalog data · " : ""}Demo content <span dir="rtl">· محتوى تجريبي</span>
    </span>
  );
}

export function ResetDemoButton({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`text-destructive ${className}`}
      onClick={() => {
        if (
          !window.confirm(
            "Reset the demo? This clears both learners' journeys, profiles and the BOM. Saved lab circuits are kept.",
          )
        )
          return;
        resetDemo();
        void navigate({ to: "/" });
      }}
    >
      <RotateCcw size={13} /> Reset demo <span dir="rtl">· إعادة ضبط</span>
    </Button>
  );
}

/** Page shell shared by the journey screens: sidebar, indicator, heading. */
export function JourneyLayout({
  active = "Learning Journey",
  step,
  eyebrow,
  title,
  arabic,
  actions,
  children,
}: {
  active?: AppSection;
  step: JourneyStepId;
  eyebrow: string;
  title: string;
  arabic: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  const journey = useJourney();
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
          active={active}
          open={menu}
          onClose={() => setMenu(false)}
          className="lg:sticky lg:top-4 lg:h-[calc(100vh-32px)]"
        />
        <main className="min-w-0 flex-1 space-y-4 pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <JourneyIndicator current={step} />
            </div>
            <LanguageToggle language={journey.language} />
            <LearnerSwitch />
          </div>
          <header className="glass-panel flex flex-wrap items-center gap-3 rounded-[22px] p-5">
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
              <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
              <h1 className="text-2xl font-bold">{title}</h1>
              <p dir="rtl" className="text-xs text-muted-foreground">
                {arabic}
              </p>
            </div>
            {actions}
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
