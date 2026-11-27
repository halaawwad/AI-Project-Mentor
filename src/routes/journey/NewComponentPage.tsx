import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Boxes,
  FileSearch,
  Loader2,
  PackagePlus,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { FallbackReasonNote, StillWorking } from "@/components/AiLabel";
import { ComponentPreview } from "@/components/ComponentPreview";
import { JourneyLayout } from "@/components/journey/JourneyUi";
import { Button } from "@/components/ui/button";
import { runAiOnce } from "@/lib/ai/useAi";
import { cleanPartName, componentCheckpoint, lookupComponent, type ComponentLookup } from "@/lib/journey/componentAi";
import {
  customPartDefinition,
  customPartId,
  deleteCustomPart,
  saveCustomPart,
  useCustomParts,
} from "@/lib/lab/customParts";
import { useJourney } from "@/lib/journey/store";
import { LEARNER_ID } from "@/lib/learner";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/** Online datasheet and external model search remain unavailable in this client-only demo. */
const plannedSteps = [
  {
    icon: FileSearch,
    title: "Find the official datasheet",
    arabic: "البحث عن الـDatasheet الرسمي",
    text: "Look up the manufacturer's datasheet for the exact part number. AiPM doesn't search the web.",
  },
  {
    icon: Boxes,
    title: "External 3D model search",
    arabic: "البحث عن نموذج ثلاثي الأبعاد",
    text: "For an official model, check the manufacturer site, KiCad library or SnapEDA.",
  },
];

/** New component: catalog parts from local data; other parts described by Gemini (verify with the datasheet). */
export function NewComponentPage() {
  useDocumentTitle("New component | AiPM");
  const journey = useJourney();
  const savedParts = useCustomParts();
  const language = journey.language;
  const dir = language === "ar" ? "rtl" : "ltr";
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ name: string; value: ComponentLookup } | null>(null);
  const [saveNotice, setSaveNotice] = useState("");
  const ask = async (force = false) => {
    const part = cleanPartName(name);
    if (busy || part.length < 2) return;
    setBusy(true);
    const learner = LEARNER_ID;
    try {
      const value = await runAiOnce(
        `component|${learner}|${componentCheckpoint(part)}|${language}`,
        () =>
          lookupComponent({
            learnerId: learner,
            ctx: { name: part, language, projectTitle: journey.project?.title.en ?? "", projectParts: journey.parts.map((p) => p.key) },
          }),
        force,
      );
      setResult({ name: part, value });
    } finally {
      setBusy(false);
    }
  };
  const value = result?.value;
  const readySpec = value?.kind === "ai" ? value.info.partSpec : undefined;
  const previewPart =
    value?.kind === "ai" && readySpec
      ? {
          id: customPartId(value.info.name),
          name: value.info.name,
          spec: readySpec,
        }
      : undefined;
  const savedPreview = useMemo(
    () => (previewPart ? customPartDefinition(previewPart) : undefined),
    [previewPart?.id, previewPart?.name, readySpec],
  );
  const savePart = () => {
    if (!value || value.kind !== "ai" || !value.info.partSpec) return;
    try {
      saveCustomPart(value.info.name, value.info.partSpec);
      setSaveNotice(`${value.info.name} saved to My parts.`);
    } catch {
      setSaveNotice("Could not save this part. Check the local storage notice and try again.");
    }
  };
  const removePart = (id: string, partName: string) => {
    if (!window.confirm(`Remove ${partName} from My parts? Saved lab projects using it may no longer load.`))
      return;
    try {
      deleteCustomPart(id);
      setSaveNotice(`${partName} removed from My parts.`);
    } catch {
      setSaveNotice("Could not remove this part. Check the local storage notice and try again.");
    }
  };
  return (
    <JourneyLayout step="parts" eyebrow="New component" title="Add a new component" arabic="إضافة قطعة جديدة">
      <section className="glass-panel rounded-panel p-5">
        <p className="text-sm">
          The catalog has 43 parts. For another part, the mentor can describe it and build a generic
          3D breakout model from a checked pin specification. Confirm every detail against the exact
          part's datasheet before wiring.
        </p>
        <p dir="rtl" className="text-xs text-muted-foreground">
          يمكن للمرشد وصف القطعة وإنشاء نموذج لوحة عام من مواصفات أطراف تم التحقق منها. تحقّق من
          جميع التفاصيل في Datasheet الرسمي قبل التوصيل.
        </p>
        <label htmlFor="new-part" className="mt-4 block text-xs font-semibold">
          Part name or number · اسم القطعة أو رقمها
        </label>
        <form
          className="mt-1 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void ask();
          }}
        >
          <input
            id="new-part"
            dir="auto"
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. TM1637 4-digit display"
            className="h-9 min-w-64 flex-1 rounded-md border border-border bg-card px-3 text-sm"
          />
          <Button type="submit" disabled={busy || cleanPartName(name).length < 2}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <PackagePlus size={15} />} Ask the mentor · اسأل المرشد
          </Button>
          <StillWorking active={busy} />
        </form>
      </section>

      {value?.kind === "catalog" && (
        <section className="glass-panel rounded-panel p-5 text-sm" role="status">
          <p className="font-semibold">
            {value.item.name} is already in the catalog · موجودة في الكتالوج
          </p>
          <p className="text-xs text-muted-foreground">Local content · محتوى محلي — {value.item.arabic}</p>
          <Button className="mt-2" size="sm" asChild>
            <Link to="/catalog" search={{ part: value.item.key }}>
              Open its catalog page
            </Link>
          </Button>
        </section>
      )}
      {value?.kind === "invalid-name" && (
        <p className="text-sm text-destructive">Enter a part name of 2–60 characters.</p>
      )}
      {value?.kind === "none" && (
        <section className="glass-panel rounded-panel p-5 text-sm" role="status">
          <p className="font-semibold">No information for “{result!.name}” · لا توجد معلومات</p>
          <p className="text-xs text-muted-foreground">
            There is no local content for parts outside the catalog, and nothing was made up.
          </p>
          <FallbackReasonNote reason={value.fallbackReason} onRetry={() => ask(true)} />
        </section>
      )}
      {value?.kind === "ai" && (
        <section className="glass-panel space-y-3 rounded-panel p-5" aria-label="AI information">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold">{value.info.name}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-soft-amber px-2.5 py-0.5 text-[11px] font-semibold">
              <Sparkles size={12} /> AI-generated · AI information — verify with the datasheet{" "}
              <span dir="rtl">· معلومات بالذكاء الاصطناعي — تحقّق منها في الـDatasheet</span>
            </span>
          </div>
          <div dir={dir} className="grid gap-3 text-sm md:grid-cols-2">
            <p>
              <b>{language === "ar" ? "ما هي: " : "What it is: "}</b>
              {value.info.whatItIs}
            </p>
            <p>
              <b>{language === "ar" ? "الجهد المعتاد: " : "Typical voltage: "}</b>
              <span dir="ltr">{value.info.voltage}</span>
            </p>
            <p>
              <b>{language === "ar" ? "الاستخدام المعتاد: " : "Typical use: "}</b>
              {value.info.typicalUse}
            </p>
            <p>
              <b>{language === "ar" ? "في مشروعك: " : "In your project: "}</b>
              {value.info.projectFit}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Typical pins · الأطراف المعتادة</h3>
            <ul dir={dir} className="mt-1 grid gap-1 text-sm sm:grid-cols-2">
              {value.info.typicalPins.map((pin) => (
                <li key={`${pin.name}-${pin.function}`} className="glass-inset rounded-md px-2 py-1">
                  <code dir="ltr">{pin.name}</code> — {pin.function}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <ShieldAlert size={14} /> Safety notes · ملاحظات السلامة
            </h3>
            <ul dir={dir} className="mt-1 list-disc ps-5 text-sm">
              {value.info.safetyNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <p className="rounded-lg border border-dashed border-border p-2">
              Datasheet: not linked — find the manufacturer's document for your exact part. · لم يُرفق رابط.
            </p>
            <p className="rounded-lg border border-dashed border-border p-2">
              This is a generic procedural model, not an official model of the exact part.
            </p>
          </div>
          {readySpec && savedPreview ? (
            <section className="grid gap-4 border-t border-border/70 pt-4 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.8fr)]">
              <div>
                <h3 className="text-sm font-semibold">Generated 3D breakout model</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {readySpec.category} · {readySpec.boardSizeMm.width} × {readySpec.boardSizeMm.depth} mm ·{" "}
                  {readySpec.pins.length} labeled pins
                </p>
                {value.info.specRepairs?.length ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Model layout adjusted for fit: {value.info.specRepairs.join(", ")}.
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={savePart}>
                    <PackagePlus size={14} />
                    {savedParts.some((part) => part.id === customPartId(value.info.name))
                      ? "Update my parts"
                      : "Add to my parts"}
                  </Button>
                  {savedParts.some((part) => part.id === customPartId(value.info.name)) && (
                    <Button size="sm" variant="secondary" asChild>
                      <Link
                        to="/lab"
                        search={{
                          add: customPartId(value.info.name),
                          request: Date.now().toString(),
                        }}
                      >
                        Place in 3D Lab
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
              <ComponentPreview model={customPartId(value.info.name)} definition={savedPreview} />
            </section>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-3 text-xs" role="note">
              The information is available, but its pin specification could not be verified. No 3D
              part was created. {value.info.specWarning}
            </p>
          )}
        </section>
      )}

      {saveNotice && (
        <p className="text-sm" role="status">
          {saveNotice}
        </p>
      )}

      <section className="glass-panel space-y-3 rounded-panel p-5">
        <h2 className="text-base font-bold">My AI-generated parts</h2>
        <p className="text-xs text-muted-foreground">
          Saved on this device. Verify every pin and voltage against the exact datasheet.
        </p>
        {savedParts.length ? (
          <ul className="divide-y divide-border/70">
            {savedParts.map((part) => (
              <li key={part.id} className="flex flex-wrap items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{part.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {part.spec.category} · {part.spec.pins.length} pins · AI-generated part — verify with the datasheet
                  </p>
                </div>
                <Button size="sm" variant="secondary" asChild>
                  <Link to="/catalog" search={{ part: part.id }}>Catalog</Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${part.name} from My parts`}
                  onClick={() => removePart(part.id, part.name)}
                >
                  <Trash2 size={14} />
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
            No saved parts yet. A verified pin specification will let you add one here.
          </p>
        )}
      </section>

      <ol className="grid gap-4 md:grid-cols-2">
        {plannedSteps.map(({ icon: Icon, title, arabic, text }, i) => (
          <li key={title} className="glass-panel rounded-panel p-5 opacity-80">
            <span className="ds-kicker">
              {title === "External 3D model search" ? "Coming soon" : "Not available yet"}
            </span>
            <h2 className="mt-2 flex items-center gap-2 text-sm font-bold">
              <Icon size={16} /> {title}
            </h2>
            <p dir="rtl" className="text-xs text-muted-foreground">
              {arabic}
            </p>
            <p className="mt-2 text-sm">{text}</p>
            <p className="mt-3 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
              {title === "External 3D model search"
                ? "Coming soon · قريباً — external model search is not available."
                : "Not available in this offline demo."}
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
