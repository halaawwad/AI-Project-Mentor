import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Cpu,
  Info,
  Lightbulb,
  Loader2,
  Menu,
  Minus,
  Package,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { JourneyIndicator } from "@/components/journey/JourneyUi";
import { Button } from "@/components/ui/button";
import { startIdeaJourney } from "@/lib/journey/store";
import { usePartPreviews } from "@/lib/lab/usePartPreviews";
import {
  addManyToBom,
  catalogByKey,
  catalogCategories,
  categoryLabel,
  componentCatalog,
} from "@/lib/componentCatalog";
import { exampleProjects } from "@/lib/suggest/examples";
import { fallbackMessages } from "@/lib/suggest/messages";
import { suggestParts, type PartSuggestion, type SuggestionResult } from "@/lib/suggest";
import { MAX_SUGGESTED_QUANTITY } from "@/lib/suggest/types";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

const MAX_DESCRIPTION = 2000;

/** "Describe your project": suggestions → review and edit → approve into the BOM. */
export function DescribePage() {
  useDocumentTitle("Describe your project | AiPM");
  const previews = usePartPreviews();
  const navigate = useNavigate();
  // The description the current results were made for (the textarea may change afterwards).
  const [resultDescription, setResultDescription] = useState("");
  const [menu, setMenu] = useState(false),
    [description, setDescription] = useState(""),
    [loading, setLoading] = useState(false),
    [result, setResult] = useState<SuggestionResult | null>(null),
    [parts, setParts] = useState<PartSuggestion[]>([]),
    [addKey, setAddKey] = useState(""),
    [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null),
    [approved, setApproved] = useState(false);
  // One request at a time: the ref blocks re-entry before React re-renders the disabled button.
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const run = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setNotice(null);
    try {
      const next = await suggestParts(trimmed);
      if (!mounted.current) return;
      setResult(next);
      setResultDescription(trimmed);
      setParts(next.parts);
      setApproved(false);
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  };

  const edit = (change: (current: PartSuggestion[]) => PartSuggestion[]) => {
    setParts(change);
    setApproved(false);
    setNotice(null);
  };
  const setQuantity = (key: string, quantity: number) =>
    edit((current) =>
      current.map((part) =>
        part.key === key
          ? { ...part, quantity: Math.max(1, Math.min(MAX_SUGGESTED_QUANTITY, quantity)) }
          : part,
      ),
    );
  const addPart = () => {
    const item = catalogByKey.get(addKey);
    if (!item || parts.some((part) => part.key === item.key)) return;
    const arabic = result?.language === "ar";
    edit((current) => [
      ...current,
      {
        key: item.key,
        quantity: 1,
        role: arabic ? "أضفتها أنت." : "Added by you.",
        reason: "",
      },
    ]);
    setAddKey("");
  };
  const approve = () => {
    try {
      addManyToBom(parts.map(({ key, quantity }) => ({ key, quantity })));
      const units = parts.reduce((sum, part) => sum + part.quantity, 0);
      setApproved(true);
      setNotice({ text: `Added ${units} units (${parts.length} parts) to your BOM.`, ok: true });
    } catch {
      setNotice({
        text: "Could not save BOM in this browser. Please enable local storage.",
        ok: false,
      });
    }
  };

  const available = componentCatalog.filter((item) => !parts.some((part) => part.key === item.key));
  const units = parts.reduce((sum, part) => sum + part.quantity, 0);
  const dir = result?.language === "ar" ? "rtl" : "ltr";

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
          active="Describe Project"
          open={menu}
          onClose={() => setMenu(false)}
          className="lg:sticky lg:top-4 lg:h-[calc(100vh-32px)]"
        />
        <main className="min-w-0 flex-1 space-y-4 pb-6">
          <JourneyIndicator current={result ? "parts" : "idea"} />
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
              <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                FROM IDEA TO PARTS LIST
              </p>
              <h1 className="text-2xl font-bold">Describe your project</h1>
              <p dir="rtl" className="text-xs text-muted-foreground">
                صف مشروعك
              </p>
            </div>
          </header>

          <section className="glass-panel rounded-[22px] p-5" aria-label="Project description">
            <label htmlFor="project-description" className="text-sm font-semibold">
              What do you want to build? <span dir="rtl">· ماذا تريد أن تبني؟</span>
            </label>
            <textarea
              id="project-description"
              dir="auto"
              value={description}
              maxLength={MAX_DESCRIPTION}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="e.g. A night light that turns on when the room gets dark · مثال: مصباح ليلي يضيء عندما تظلم الغرفة"
              className="mt-2 min-h-32 w-full resize-y rounded-xl border border-border bg-card/80 p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="mt-1 text-right text-[10px] text-muted-foreground">
              {description.length} / {MAX_DESCRIPTION}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                disabled={loading || !description.trim()}
                aria-busy={loading}
                onClick={() => void run(description)}
              >
                {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {loading ? "Finding parts…" : "Suggest parts"}
              </Button>
              <span className="text-[11px] font-semibold text-muted-foreground">
                <Lightbulb size={12} className="mr-1 inline" />
                Examples · أمثلة:
              </span>
              {exampleProjects.map((example) => (
                <button
                  key={example.id}
                  disabled={loading}
                  onClick={() => {
                    setDescription(example.description);
                    void run(example.description);
                  }}
                  className="rounded-full border border-border bg-card/70 px-3 py-1 text-xs hover:bg-accent disabled:opacity-50"
                >
                  {example.title.en} <span dir="rtl">· {example.title.ar}</span>
                </button>
              ))}
            </div>
            {loading && (
              <p role="status" className="mt-3 text-xs text-muted-foreground">
                Finding parts for your project… <span dir="rtl">جارٍ البحث عن القطع لمشروعك…</span>
              </p>
            )}
          </section>

          {result && !loading && (
            <section className="glass-panel rounded-[22px] p-5" aria-label="Suggested parts">
              <SourceLabel result={result} />
              {result.summary && (
                <p dir={dir} className="mt-3 text-sm leading-7">
                  {result.summary}
                </p>
              )}
              {!!result.droppedCount && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {result.droppedCount} suggested item{result.droppedCount === 1 ? " was" : "s were"}{" "}
                  removed because {result.droppedCount === 1 ? "it was" : "they were"} not a valid
                  catalog part or quantity.
                </p>
              )}

              {parts.length ? (
                <ul className="mt-4 space-y-2">
                  {parts.map((part) => {
                    const item = catalogByKey.get(part.key)!;
                    return (
                      <li
                        key={part.key}
                        data-category-tone={catalogCategories.indexOf(item.category)}
                        className="glass-inset flex flex-wrap items-center gap-3 rounded-xl p-3"
                      >
                        <span className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
                          {previews[item.model] ? (
                            <img src={previews[item.model]} alt="" className="h-full w-full object-contain" />
                          ) : (
                            <Cpu size={20} className="text-primary" />
                          )}
                        </span>
                        <div className="min-w-[12rem] flex-1">
                          <Link
                            to="/catalog"
                            search={{ part: item.key }}
                            className="text-sm font-bold hover:underline"
                          >
                            {item.name}
                          </Link>
                          <span dir="rtl" className="ms-2 text-xs text-muted-foreground">
                            {item.arabic}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            {categoryLabel(item.category)} · <span className="font-mono">{item.key}</span>
                          </span>
                          <p dir={dir} className="mt-1 text-xs leading-5">
                            <strong>{dir === "rtl" ? "الدور: " : "Role: "}</strong>
                            {part.role}
                          </p>
                          {part.reason && (
                            <p dir={dir} className="text-xs leading-5 text-muted-foreground">
                              <strong>{dir === "rtl" ? "السبب: " : "Why: "}</strong>
                              {part.reason}
                            </p>
                          )}
                        </div>
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={`Decrease ${item.name} quantity`}
                            disabled={part.quantity <= 1}
                            onClick={() => setQuantity(part.key, part.quantity - 1)}
                          >
                            <Minus />
                          </Button>
                          <span className="w-8 text-center font-mono text-sm" aria-live="polite">
                            {part.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={`Increase ${item.name} quantity`}
                            disabled={part.quantity >= MAX_SUGGESTED_QUANTITY}
                            onClick={() => setQuantity(part.key, part.quantity + 1)}
                          >
                            <Plus />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive"
                            aria-label={`Remove ${item.name}`}
                            onClick={() => edit((current) => current.filter((p) => p.key !== part.key))}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
                  <Package className="mx-auto text-primary" />
                  <h2 className="mt-3 text-sm font-bold">No matching parts found</h2>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Try naming what the project should sense, show or move, or add parts yourself
                    below.
                  </p>
                  <p dir="rtl" className="mt-1 text-xs text-muted-foreground">
                    لم نجد قطعاً مطابقة. اذكر ما يجب أن يستشعره المشروع أو يعرضه أو يحرّكه، أو أضف
                    القطع بنفسك.
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <label htmlFor="add-part" className="text-xs font-semibold">
                  Add a part · أضف قطعة
                </label>
                <select
                  id="add-part"
                  value={addKey}
                  onChange={(event) => setAddKey(event.target.value)}
                  className="h-8 max-w-xs rounded-md border border-border bg-card px-2 text-xs"
                >
                  <option value="">Choose from the catalog…</option>
                  {catalogCategories.map((category) => {
                    const options = available.filter((item) => item.category === category);
                    return options.length ? (
                      <optgroup key={category} label={categoryLabel(category)}>
                        {options.map((item) => (
                          <option key={item.key} value={item.key}>
                            {item.name} · {item.arabic}
                          </option>
                        ))}
                      </optgroup>
                    ) : null;
                  })}
                </select>
                <Button size="sm" variant="secondary" disabled={!addKey} onClick={addPart}>
                  <Plus size={13} /> Add
                </Button>
                <div className="flex-1" />
                <span className="text-xs text-muted-foreground">
                  {units} units · {parts.length} parts
                </span>
                <Button disabled={!parts.length || approved} onClick={approve}>
                  {approved ? <Check /> : <Package />}
                  {approved ? "Approved" : "Approve list"}
                </Button>
              </div>
              {notice && (
                <div
                  role="status"
                  className="catalog-notice mt-3 flex items-center justify-between gap-3 rounded-xl p-3 text-xs"
                >
                  <span>
                    {notice.text}{" "}
                    {notice.ok && (
                      <Link to="/bom" className="font-semibold underline">
                        Open BOM
                      </Link>
                    )}
                  </span>
                  <button aria-label="Dismiss message" onClick={() => setNotice(null)}>
                    <X size={14} />
                  </button>
                </div>
              )}
              {approved && (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-mint/60 p-3">
                  <p className="min-w-0 flex-1 text-sm">
                    Next: a quick level check, then a learning path for this parts list.
                    <span dir="rtl" className="block text-xs">
                      التالي: تحديد سريع للمستوى ثم مسار تعلّم لهذه القطع.
                    </span>
                  </p>
                  <Button
                    onClick={() => {
                      startIdeaJourney(
                        resultDescription,
                        parts.map(({ key, quantity }) => ({ key, quantity })),
                      );
                      void navigate({ to: "/journey/level" });
                    }}
                  >
                    Continue to level check →
                  </Button>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function SourceLabel({ result }: { result: SuggestionResult }) {
  if (result.source === "ai")
    return (
      <div className="flex flex-wrap items-start gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1 text-xs font-semibold text-mint-foreground">
          <Sparkles size={13} /> AI suggestions <span dir="rtl">· اقتراحات الذكاء الاصطناعي</span>
        </span>
        <p className="text-[11px] leading-5 text-muted-foreground">
          Generated by Gemini from the AiPM catalog. Review every part, quantity and reason before
          approving.
          <span dir="rtl" className="block">
            أنشأها Gemini من كتالوج AiPM. راجع كل قطعة وكميتها وسببها قبل الاعتماد.
          </span>
        </p>
      </div>
    );
  const message = result.fallbackReason ? fallbackMessages[result.fallbackReason] : null;
  return (
    <div className="flex flex-wrap items-start gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold">
        <Info size={13} /> Demo suggestions (local){" "}
        <span dir="rtl">· اقتراحات تجريبية (محلية)</span>
      </span>
      {message && (
        <p role={result.fallbackReason === "missing-key" ? undefined : "alert"} className="text-[11px] leading-5 text-muted-foreground">
          {message.en}
          <span dir="rtl" className="block">
            {message.ar}
          </span>
        </p>
      )}
    </div>
  );
}
