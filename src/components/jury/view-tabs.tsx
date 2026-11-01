"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Client tab switcher whose panels are server-rendered nodes (used for ADMIN: panel overview / own scoring). */
export function ViewTabs({ items, defaultValue }: { items: { value: string; label: string; content: React.ReactNode }[]; defaultValue?: string }) {
  return (
    <Tabs defaultValue={defaultValue ?? items[0]?.value} className="gap-5">
      <TabsList className="h-9">
        {items.map((it) => (
          <TabsTrigger key={it.value} value={it.value} className="px-3">
            {it.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((it) => (
        <TabsContent key={it.value} value={it.value}>
          {it.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
