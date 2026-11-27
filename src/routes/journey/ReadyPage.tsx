import { Link } from "@tanstack/react-router";
import { ArrowRight, Box, CheckCircle2, Package, PartyPopper } from "lucide-react";
import { DemoBadge, JourneyLayout, ResetDemoButton } from "@/components/journey/JourneyUi";
import { PartLinks } from "@/components/journey/PartLinks";
import { SkillsPanel } from "@/components/journey/Personalization";
import { Button } from "@/components/ui/button";
import { usePartPreviews } from "@/lib/lab/usePartPreviews";
import { allPassed, skillsOf, stageStatuses } from "@/lib/journey/grading";
import { skillLabel } from "@/lib/journey/i18n";
import { levelInfo } from "@/lib/journey/level";
import { buildPath } from "@/lib/journey/path";
import { useJourney } from "@/lib/journey/store";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/** Final screen: shown only when every stage is passed. */
export function ReadyPage() {
  useDocumentTitle("Ready to build | AiPM");
  const journey = useJourney();
  const previews = usePartPreviews();
  const stages = buildPath(journey);

  if (!journey.project || !journey.level || !allPassed(stages, journey.progress)) {
    const statuses = stageStatuses(stages, journey.progress);
    const left = stages.filter((_, i) => statuses[i] !== "passed").length;
    return (
      <JourneyLayout step="path" eyebrow="Almost there" title="Not ready yet" arabic="لم تصبح جاهزاً بعد">
        <section className="glass-panel rounded-panel p-6 text-sm">
          <p>
            {stages.length
              ? `Pass the remaining ${left} stage${left === 1 ? "" : "s"} to finish your learning path.`
              : "Start a learning journey first."}
          </p>
          <Button className="mt-3" asChild>
            <Link to="/journey">Go to the learning path</Link>
          </Button>
        </section>
      </JourneyLayout>
    );
  }

  const skills = skillsOf(stages);
  const lang = journey.language;
  const dir = lang === "ar" ? "rtl" : "ltr";
  const units = journey.parts.reduce((sum, part) => sum + part.quantity, 0);
  return (
    <JourneyLayout
      step="ready"
      eyebrow="Journey complete"
      title="Ready to build your project"
      arabic="أنت جاهز لبناء مشروعك"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <DemoBadge />
          <ResetDemoButton />
        </div>
      }
    >
      <section className="glass-panel glass-strong rounded-panel p-6">
        <p dir={dir} className="flex items-center gap-2 text-xl font-bold">
          <PartyPopper className="text-primary" /> {journey.project.title[lang]}
        </p>
        <p dir={dir} className="mt-1 text-sm text-muted-foreground">
          {lang === "ar"
            ? `المستوى: ${levelInfo[journey.level].title.ar} · اجتزت ${stages.length} مراحل · ${units} قطعة في قائمتك`
            : `Level: ${levelInfo[journey.level].title.en} · ${stages.length} stages passed · ${units} units in your parts list`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/lab">
              <Box size={15} /> Build it in the 3D Lab
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/bom">
              <Package size={15} /> Open my BOM
            </Link>
          </Button>
        </div>
      </section>
      <SkillsPanel profile={journey.profile} stages={stages} language={lang} title="Final mastery per skill" />
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="glass-panel rounded-panel p-5" aria-label="Skills learned">
          <h2 className="text-sm font-bold">
            Skills learned <span dir="rtl" className="font-normal">· المهارات المكتسبة</span>
          </h2>
          <ul dir={dir} className="mt-2 flex flex-wrap gap-1.5">
            {skills.map((skill) => (
              <li key={skill} className="flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-xs text-mint-foreground">
                <CheckCircle2 size={12} /> {skillLabel(skill, lang)}
              </li>
            ))}
          </ul>
          <h2 className="mt-4 text-sm font-bold">
            Stage scores <span dir="rtl" className="font-normal">· نتائج المراحل</span>
          </h2>
          <ol className="mt-2 space-y-1 text-sm">
            {stages.map((stage, i) => {
              const progress = journey.progress[stage.id]!;
              return (
                <li key={stage.id} dir={dir} className="flex justify-between gap-2">
                  <span>
                    {i + 1}. {stage.title[lang]}
                  </span>
                  <span className="text-muted-foreground">
                    {lang === "ar"
                      ? `${progress.bestScore}% · ${progress.attempts} ${progress.attempts === 1 ? "محاولة" : "محاولات"}`
                      : `${progress.bestScore}% · ${progress.attempts} attempt${progress.attempts === 1 ? "" : "s"}`}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
        <section className="glass-panel rounded-panel p-5" aria-label="Parts">
          <h2 className="text-sm font-bold">
            Your parts <span dir="rtl" className="font-normal">· قطعك</span>
          </h2>
          <ul className="mt-2 space-y-1.5">
            {journey.parts.map((part) => (
              <PartLinks key={part.key} partKey={part.key} quantity={part.quantity} previews={previews} />
            ))}
          </ul>
          <Button variant="ghost" className="mt-3" asChild>
            <Link to="/journey">
              Back to the learning path <ArrowRight size={14} />
            </Link>
          </Button>
        </section>
      </div>
    </JourneyLayout>
  );
}
