import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Box, Package, PackagePlus, Sparkles } from "lucide-react";
import { FallbackReasonNote, StillWorking } from "@/components/AiLabel";
import { ComponentPreview } from "@/components/ComponentPreview";
import { Button } from "@/components/ui/button";
import { runAiOnce } from "@/lib/ai/useAi";
import { LEARNER_ID } from "@/lib/learner";
import {
  catalogMatchFromLookup,
  cleanPartName,
  componentCheckpoint,
  lookupComponent,
  type ComponentLookup,
} from "@/lib/journey/componentAi";
import { addToBom, type CatalogComponent } from "@/lib/componentCatalog";
import {
  customPartDefinition,
  customPartId,
  saveCustomPart,
  useCustomParts,
  type SavedCustomPart,
} from "@/lib/lab/customParts";
import { detectLanguage } from "@/lib/suggest/language";
import type { Language } from "@/lib/journey/types";

interface CustomPartGeneratorProps {
  name: string;
  language?: Language;
  projectTitle?: string;
  projectParts?: string[];
  showCatalogActions?: boolean;
  onSaved?: (part: SavedCustomPart) => void;
  onCatalogMatch?: (item: CatalogComponent) => void;
}

export function CustomPartGenerator({
  name,
  language = detectLanguage(name),
  projectTitle = "",
  projectParts = [],
  showCatalogActions = true,
  onSaved,
  onCatalogMatch,
}: CustomPartGeneratorProps) {
  const savedParts = useCustomParts();
  const [result, setResult] = useState<ComponentLookup | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [notice, setNotice] = useState("");
  const normalizedName = cleanPartName(name);
  const partsKey = projectParts.join("\u0000");

  useEffect(() => {
    let active = true;
    setResult(null);
    setNotice("");
    setLoading(true);
    const key = `component|${LEARNER_ID}|${componentCheckpoint(normalizedName)}|${language}`;
    void runAiOnce(
      key,
      () =>
        lookupComponent({
          learnerId: LEARNER_ID,
          ctx: {
            name: normalizedName,
            language,
            projectTitle,
            projectParts: partsKey ? partsKey.split("\u0000") : [],
          },
        }),
      retry > 0,
    )
      .then((value) => {
        if (active) setResult(value);
      })
      .catch(() => {
        if (active) setNotice("Could not load part information. Try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [normalizedName, language, projectTitle, partsKey, retry]);

  const info = result?.kind === "ai" ? result.info : null;
  const matchedCatalogItem = result ? catalogMatchFromLookup(result) : null;
  const partId = info ? customPartId(info.name) : "";
  const preview =
    info?.partSpec && partId
      ? customPartDefinition({ id: partId, name: info.name, spec: info.partSpec })
      : undefined;
  const saved = savedParts.find((part) => part.id === partId);
  const save = () => {
    if (!info?.partSpec) return;
    try {
      const part = saveCustomPart(info.name, info.partSpec);
      setNotice(`${part.name} saved to My parts.`);
      onSaved?.(part);
    } catch {
      setNotice("Could not save this part. Check the local storage notice and try again.");
    }
  };
  const addBom = () => {
    if (!saved) return;
    try {
      addToBom(saved.id);
      setNotice(`${saved.name} added to BOM.`);
    } catch {
      setNotice("Could not save BOM in this browser. Please enable local storage.");
    }
  };

  return (
    <section className="glass-panel space-y-3 rounded-panel p-4" aria-label="Generate custom part">
      {loading ? (
        <div className="flex items-center gap-2 text-sm" role="status">
          <StillWorking active />
          <span>Generating part information…</span>
        </div>
      ) : matchedCatalogItem ? (
        <div className="space-y-2 text-sm" role="status">
          <p>
            This name matches a part already in our library.{" "}
            <span dir="rtl">هذا الاسم يطابق قطعة موجودة في مكتبتنا.</span>
          </p>
          <Link
            to="/catalog"
            search={{ part: matchedCatalogItem.key }}
            className="font-semibold text-primary underline"
          >
            {matchedCatalogItem.name}
          </Link>
          {onCatalogMatch && (
            <div>
              <Button size="sm" variant="secondary" onClick={() => onCatalogMatch(matchedCatalogItem)}>
                <PackagePlus size={14} /> Add to reviewed list
              </Button>
            </div>
          )}
        </div>
      ) : result?.kind === "ai" ? (
        <>
          <p className="text-xs text-muted-foreground">
            This part isn't in our library yet — I can generate it for you with AI.
            <span dir="rtl" className="ms-1">
              هذه القطعة غير موجودة في مكتبتنا بعد — يمكنني توليدها لك بالذكاء الاصطناعي.
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold">{result.info.name}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-soft-amber px-2.5 py-1 text-[10px] font-semibold">
              <Sparkles size={12} /> AI-generated — verify with the datasheet
            </span>
          </div>
          <div className="grid gap-3 text-xs sm:grid-cols-2">
            <p>
              <strong>What it is: </strong>
              {result.info.whatItIs}
            </p>
            <p>
              <strong>Typical voltage: </strong>
              <span dir="ltr">{result.info.voltage}</span>
            </p>
            <p>
              <strong>Typical use: </strong>
              {result.info.typicalUse}
            </p>
            <p>
              <strong>For this project: </strong>
              {result.info.projectFit}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {result.info.typicalPins.map((pin) => (
              <span key={`${pin.name}-${pin.function}`} className="glass-inset rounded-md px-2 py-1 text-[10px]">
                <code dir="ltr">{pin.name}</code> · {pin.function}
              </span>
            ))}
          </div>
          {preview && result.info.partSpec ? (
            <div className="grid gap-3 border-t border-border/70 pt-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
              <div className="space-y-2">
                <p className="text-xs font-semibold">Generic procedural breakout model</p>
                <p className="text-[11px] text-muted-foreground">
                  {result.info.partSpec.category} · {result.info.partSpec.boardSizeMm.width} ×{" "}
                  {result.info.partSpec.boardSizeMm.depth} mm · {result.info.partSpec.pins.length} labeled pins
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Not an official model or verified pinout. Check the datasheet before wiring.
                </p>
                <div className="flex flex-wrap gap-1">
                  {result.info.partSpec.pins.map((pin) => (
                    <span
                      key={pin.name}
                      className="glass-inset rounded-md px-2 py-1 text-[10px]"
                    >
                      <code dir="ltr">{pin.name}</code> · {pin.kind}
                      {pin.logicVoltage === null ? "" : ` · ${pin.logicVoltage}V logic`}
                    </span>
                  ))}
                </div>
                <Button size="sm" onClick={save}>
                  <PackagePlus size={14} />
                  {saved ? "Update my parts" : "Add to my parts"}
                </Button>
              </div>
              <ComponentPreview model={partId} definition={preview} />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-3 text-xs" role="note">
              Information is available, but its pin specification could not be verified. No 3D part
              was created. {result.info.specWarning}
            </p>
          )}
          {saved && showCatalogActions && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={addBom}>
                <Package size={14} /> Add to BOM
              </Button>
              <Button size="sm" asChild>
                <Link
                  to="/lab"
                  search={{ add: saved.id, request: Date.now().toString() }}
                >
                  <Box size={14} /> Place in 3D Lab
                </Link>
              </Button>
            </div>
          )}
        </>
      ) : result?.kind === "none" ? (
        <div className="text-sm">
          <p>No reliable information was available for “{normalizedName}”.</p>
          <FallbackReasonNote
            reason={result.fallbackReason}
            onRetry={async () => setRetry((current) => current + 1)}
          />
        </div>
      ) : result?.kind === "catalog" ? (
        <p className="text-sm" role="status">
          {result.item.name} is already available in the catalog.
        </p>
      ) : (
        <p className="text-sm" role="alert">
          Enter a part name between 2 and 60 characters.
        </p>
      )}
      {notice && (
        <p className="text-xs" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
