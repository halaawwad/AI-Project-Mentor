import { useEffect, useState } from "react";
import {
  currentStorageFailure,
  resetUnreadable,
  storageEvent,
  unreadableKeys,
} from "@/lib/storage";

/** Adapted from LabAssist `shared/web/LocalStorageNotice.tsx`, with an explicit reset option. */
export function LocalStorageNotice() {
  const [error, setError] = useState("");
  const [canReset, setCanReset] = useState(false);
  useEffect(() => {
    const update = () => {
      setError(currentStorageFailure());
      setCanReset(unreadableKeys().length > 0);
    };
    update();
    window.addEventListener(storageEvent, update);
    return () => window.removeEventListener(storageEvent, update);
  }, []);
  if (!error) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-3 top-3 z-[60] mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-xs text-foreground shadow-lg"
    >
      <p className="min-w-0 flex-1 leading-5">
        {error}
        <span dir="rtl" className="block">
          تعذر تحميل البيانات المحفوظة أو حفظها. اسمح بالتخزين ثم أعد التحميل.
        </span>
      </p>
      <button
        className="rounded-md border border-border px-3 py-1.5 font-semibold hover:bg-accent"
        onClick={() => window.location.reload()}
      >
        Retry loading / إعادة التحميل
      </button>
      {canReset && (
        <button
          className="rounded-md border border-destructive/40 px-3 py-1.5 font-semibold text-destructive hover:bg-destructive/10"
          onClick={() => {
            if (
              !window.confirm(
                "Reset the saved AiPM data that could not be read? This cannot be undone.",
              )
            )
              return;
            resetUnreadable();
            window.location.reload();
          }}
        >
          Reset unreadable data / إعادة الضبط
        </button>
      )}
    </div>
  );
}
