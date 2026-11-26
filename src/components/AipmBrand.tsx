import { Cpu } from "lucide-react";

/** AiPM wordmark, using the same chip mark and sizing as the LabAssist brand it replaces. */
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
        color: tone === "white" ? "#fbfcf5" : "#35452b",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: size,
        fontWeight: 750,
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
        style={{ width: "1.45em", height: "1.45em", flexShrink: 0 }}
      />
      {!iconOnly && "AiPM"}
    </span>
  );
}
