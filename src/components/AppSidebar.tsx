import { useNavigate } from "@tanstack/react-router";
import { Box, Cpu, GraduationCap, House, Package, Sparkles, X } from "lucide-react";
import { AipmBrand } from "@/components/AipmBrand";
import { Button } from "@/components/ui/button";

/** AiPM navigation, adapted from LabAssist `WorkspaceSidebar` (same layout, AiPM screens only). */
export type AppSection =
  | "Home"
  | "Describe Project"
  | "Learning Journey"
  | "Component Catalog"
  | "Bill of Materials"
  | "3D Lab";
const navigation = [
  { label: "Home", icon: House, to: "/" },
  { label: "Describe Project", icon: Sparkles, to: "/describe" },
  { label: "Learning Journey", icon: GraduationCap, to: "/journey" },
  { label: "Component Catalog", icon: Cpu, to: "/catalog" },
  { label: "Bill of Materials", icon: Package, to: "/bom" },
  { label: "3D Lab", icon: Box, to: "/lab" },
] as const;

export function AppSidebar({
  active,
  open,
  onClose,
  className = "",
}: {
  active: AppSection;
  open: boolean;
  onClose: () => void;
  className?: string;
}) {
  const navigate = useNavigate();
  return (
    <aside
      className={`glass-panel glass-strong workspace-sidebar fixed inset-y-2.5 left-2.5 z-40 flex w-[220px] shrink-0 flex-col rounded-[18px] px-2.5 py-3 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-[110%]"} ${className}`}
    >
      <div className="flex items-center justify-between px-3 pb-5 pt-2 lg:pb-6">
        <div>
          <AipmBrand size={16} />
          <div className="text-[10px] font-medium text-muted-foreground">AI Project Mentor</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 lg:hidden"
          aria-label="Close menu"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <nav className="flex flex-col gap-1 overflow-y-auto" aria-label="Main navigation">
        {navigation.map(({ label, icon: Icon, to }) => (
          <Button
            key={label}
            variant="ghost"
            aria-current={active === label ? "page" : undefined}
            onClick={() => {
              onClose();
              if (active !== label) void navigate({ to });
            }}
            className={`h-10 w-full justify-start gap-3 rounded-[11px] px-3 text-[13px] font-medium shadow-none ${active === label ? "bg-mint text-mint-foreground hover:bg-mint" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`}
          >
            <Icon className="!size-[18px]" strokeWidth={2.2} />
            {label}
          </Button>
        ))}
      </nav>
      <p className="mt-auto px-3 pt-4 text-[10px] leading-4 text-muted-foreground">
        Local demo · your BOM and circuits are saved in this browser only.
        <span dir="rtl" className="mt-1 block">
          نسخة تجريبية محلية · تُحفظ بياناتك في هذا المتصفح فقط.
        </span>
      </p>
    </aside>
  );
}
