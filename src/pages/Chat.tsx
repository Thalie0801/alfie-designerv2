import { AlfieChat } from "@/components/AlfieChat";
import { QuotaPanel } from "@/components/dashboard/QuotaPanel";

export default function Chat() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 min-h-[calc(100vh-64px)]">
      <section className="min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-hidden rounded-xl border bg-background">
          <AlfieChat />
        </div>
      </section>

      <aside className="min-h-0 flex flex-col gap-4">
        <QuotaPanel />
      </aside>
    </div>
  );
}
