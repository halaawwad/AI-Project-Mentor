import { Cpu } from "lucide-react";

/** AiPM wordmark: the chip mark in solder-mask green and an expanded Readex Pro wordmark. */
export function AipmBrand({
  size = 20,
  tone = "olive",
  iconOnly = false,
}: {
  size?: number;
  tone?: "olive" | "white";
  iconOnly?: boolean;
}) {
  return (
    <span
      dir="ltr"
      style={{
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
        gap: "0.35em",
        margin: 0,
        color: tone === "white" ? "#ffffff" : "var(--ink)",
        fontFamily: "inherit",
        fontVariationSettings: "\"HEXP\" 30",
        fontSize: size,
        fontWeight: 650,
        fontStyle: "normal",
        lineHeight: 1.5,
        letterSpacing: "normal",
        textTransform: "none",
        whiteSpace: "nowrap",
      }}
    >
      <Cpu
        aria-hidden="true"
        strokeWidth={1.5}
        style={{ width: "1.45em", height: "1.45em", flexShrink: 0, color: tone === "white" ? "inherit" : "var(--solder)" }}
      />
      {!iconOnly && "AiPM"}
    </span>
  );
}
