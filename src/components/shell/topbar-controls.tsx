"use client";
import { useTransition } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import { Bell, Check, Languages, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setLocale, markNotificationsRead } from "@/app/actions/preferences";
import { logout } from "@/app/actions/auth";
import { UserAvatarClient } from "./user-avatar-client";
import { LOCALES, type Locale } from "@/lib/constants";

export function LocaleSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale();
  const [pending, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" aria-label={t("language")} disabled={pending} className="gap-1.5 px-2" />}>
        <Languages className="size-4" aria-hidden />
        <span className="text-xs font-semibold">{locale.toUpperCase()}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
          {LOCALES.map((l) => (
            <DropdownMenuItem key={l} onClick={() => start(() => setLocale(l as Locale))}>
              <span className="w-6 text-xs font-semibold text-muted-foreground">{l.toUpperCase()}</span>
              <span className="flex-1">{t(`languages.${l}`)}</span>
              {l === locale && <Check className="size-4 text-primary" aria-hidden />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeToggle() {
  const t = useTranslations("common.theme");
  const { theme, setTheme } = useTheme();
  const opts = [
    { v: "light", icon: Sun },
    { v: "dark", icon: Moon },
    { v: "system", icon: Monitor },
  ] as const;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t("label")} />}>
        <Sun className="size-4 dark:hidden" aria-hidden />
        <Moon className="hidden size-4 dark:block" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
          {opts.map(({ v, icon: I }) => (
            <DropdownMenuItem key={v} onClick={() => setTheme(v)}>
              <I className="size-4" aria-hidden />
              <span className="flex-1">{t(v)}</span>
              {theme === v && <Check className="size-4 text-primary" aria-hidden />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type NotificationView = { id: string; text: string; href: string | null; read: boolean; when: string };

export function NotificationBell({ items, unread }: { items: NotificationView[]; unread: number }) {
  const t = useTranslations("common.notifications");
  const ta = useTranslations("common.actions");
  const [pending, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`${t("title")}${unread ? ` (${unread})` : ""}`} className="relative" />}
      >
        <Bell className="size-4" aria-hidden />
        {unread > 0 && (
          <span className="tabular absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">{t("title")}</p>
          {unread > 0 && (
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" disabled={pending} onClick={() => start(() => markNotificationsRead())}>
              {ta("markAllRead")}
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto py-1">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            items.map((n) => (
              <DropdownMenuItem key={n.id} className="items-start gap-2 px-3 py-2" render={n.href ? <Link href={n.href} /> : undefined}>
                <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-primary"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] leading-snug whitespace-normal">{n.text}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{n.when}</span>
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserMenu({ name, email, roleLabel }: { name: string; email: string; roleLabel: string }) {
  const t = useTranslations("common.user");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-9 gap-2 px-1.5 sm:pr-3" aria-label={name} />}>
        <UserAvatarClient name={name} />
        <span className="hidden text-left sm:block">
          <span className="block max-w-36 truncate text-[13px] font-semibold leading-tight">{name}</span>
          <span className="block max-w-36 truncate text-[11px] leading-tight text-muted-foreground">{roleLabel}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block text-xs text-muted-foreground">{t("signedInAs")}</span>
            <span className="block truncate text-sm font-semibold text-foreground">{email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => logout()}>
          <LogOut className="size-4" aria-hidden />
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
