import { categoryLabel, componentCatalog, type CatalogComponent } from "@/lib/componentCatalog";
import type { PinKind } from "@/lib/lab/catalog";

const interfaceNames: Partial<Record<PinKind, string>> = {
  digital: "digital I/O",
  analog: "analog",
  pwm: "PWM",
  sda: "I2C",
  scl: "I2C",
  tx: "UART",
  rx: "UART",
  spi: "SPI/serial control",
  motor: "motor/load output",
  passive: "passive terminals",
};

/** A short, factual function line built from catalog data: lab category plus pin interfaces. */
export function shortFunction(item: CatalogComponent) {
  const interfaces = [
    ...new Set(item.def.pins.map((pin) => interfaceNames[pin.kind]).filter(Boolean)),
  ];
  return interfaces.length
    ? `${item.def.category}; interfaces: ${interfaces.join(", ")}`
    : item.def.category;
}

/** One line per part: key | English name | Arabic name | category | function | typical supply. */
export function compactCatalog() {
  return componentCatalog
    .map((item) =>
      [
        item.key,
        item.name,
        item.arabic,
        `${categoryLabel(item.category)} / ${item.category}`,
        shortFunction(item),
        item.voltage ? `${item.voltage} V` : "circuit-dependent",
      ].join(" | "),
    )
    .join("\n");
}

export const catalogKeys = () => componentCatalog.map((item) => item.key);
