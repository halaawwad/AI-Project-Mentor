import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Info, Sparkles } from "lucide-react";
import { DemoBadge, JourneyLayout } from "@/components/journey/JourneyUi";
import { PartLinks } from "@/components/journey/PartLinks";
import { Button } from "@/components/ui/button";
import { addManyToBom } from "@/lib/componentCatalog";
import { usePartPreviews } from "@/lib/lab/usePartPreviews";
import { learningProjects } from "@/lib/journey/projects";
import { startLearningJourney } from "@/lib/journey/store";
import type { LearningProjectId } from "@/lib/journey/types";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/** "I don't have an idea yet": pick a learning project, which loads its parts. */
export function ChooseProjectPage() {
  useDocumentTitle("Choose a learning project | AiPM");
  const navigate = useNavigate();
  const previews = usePartPreviews();
  const [notice, setNotice] = useState("");

  const start = (id: LearningProjectId) => {
    const project = learningProjects.find((p) => p.id === id)!;
    startLearningJourney(id);
    try {
      addManyToBom(project.parts);
    } catch {
      setNotice("The parts are loaded for the journey, but the BOM couldn't be saved in this browser.");
    }
    void navigate({ to: "/journey/level" });
  };

  return (
    <JourneyLayout
      step="idea"
      eyebrow="NO IDEA YET? START HERE"
      title="Choose a learning project"
      arabic="اختر مشروعاً تعليمياً"
      actions={<DemoBadge />}
    >
      <p className="glass-panel rounded-[18px] p-4 text-sm leading-6">
        Start with the traffic light, then move on to the parking sensor. Each project loads its parts
        into your BOM and comes with a full learning path.
        <span dir="rtl" className="block text-xs text-muted-foreground">
          ابدأ بإشارة المرور ثم انتقل إلى حساس الركن. كل مشروع يضيف قطعه إلى قائمتك ويأتي بمسار تعلّم كامل.
        </span>
      </p>
      {notice && (
        <p role="alert" className="catalog-notice rounded-xl p-3 text-xs">
          {notice}
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-3">
        {learningProjects.map((project, index) => (
          <section key={project.id} className="glass-panel flex flex-col rounded-[22px] p-5" aria-label={project.title.en}>
            <span className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground">
              {String(index + 1).padStart(2, "0")} · {project.difficulty.en.toUpperCase()}{" "}
              <span dir="rtl">· {project.difficulty.ar}</span>
            </span>
            <h2 className="mt-1 text-lg font-bold">{project.title.en}</h2>
            <p dir="rtl" className="text-sm text-muted-foreground">
              {project.title.ar}
            </p>
            <p className="mt-2 text-sm leading-6">{project.summary.en}</p>
            <p dir="rtl" className="text-xs leading-6 text-muted-foreground">
              {project.summary.ar}
            </p>
            {project.note && (
              <p className="mt-2 flex gap-1.5 text-[11px] text-muted-foreground">
                <Info size={13} className="mt-0.5 shrink-0" /> {project.note}
              </p>
            )}
            <p className="mt-3 text-xs font-semibold">
              {project.stages.length} stages · {project.parts.length} part types
            </p>
            <ul className="mt-2 flex-1 space-y-1.5">
              {project.parts.map((part) => (
                <PartLinks key={part.key} partKey={part.key} quantity={part.quantity} previews={previews} />
              ))}
            </ul>
            <Button className="mt-4" onClick={() => start(project.id)}>
              Start this project <ArrowRight size={14} />
            </Button>
          </section>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Have your own idea?{" "}
        <Link to="/describe" className="font-semibold underline">
          <Sparkles size={12} className="mr-1 inline" />
          Describe your project
        </Link>{" "}
        instead.
      </p>
    </JourneyLayout>
  );
}
