"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { KeyRound, Loader2, Lock, MoreHorizontal, Pencil, Power, PowerOff, Trash2, UserPlus } from "lucide-react";
import { DeleteUserForm } from "@/components/admin/system-forms";
import { TempPasswordBox } from "@/components/account/temp-password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, NativeSelect, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import { createUser, resetUserPassword, setUserActive, updateUser, type UserActionState } from "@/app/(app)/admin/users/actions";

const ROLES = ["ADMIN", "TEAM", "MENTOR", "JURY"] as const;
type Uni = { id: string; shortName: string; name: string };
type Issued = { email: string; password: string };

const DIALOG = "max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg";

export function CreateUserDialog({ universities, canCreateAdmin }: { universities: Uni[]; canCreateAdmin: boolean }) {
  const t = useTranslations("admin.users");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const [open, setOpen] = useState(false);
  const [issued, setIssued] = useState<Issued | null>(null);
  const { pending, onSubmit, error } = useFormAction<UserActionState>(createUser, {
    onDone: (s) => {
      toast.success(t("toastCreated"));
      if (s.tempPassword && s.email) setIssued({ email: s.email, password: s.tempPassword });
      else setOpen(false);
    },
    onFail: (s) => {
      if (s.message && !s.errors) toast.error(t(s.message as never));
    },
  });
  const err = (k: string) => (error(k) ? t(error(k) as never) : undefined);
  const aria = (id: string, k: string, hint?: boolean) => ({
    "aria-invalid": !!err(k),
    "aria-describedby": err(k) ? `${id}-error` : hint ? `${id}-hint` : undefined,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setIssued(null);
      }}
    >
      <DialogTrigger render={<Button size="lg" />}>
        <UserPlus className="size-4" aria-hidden />
        {t("create")}
      </DialogTrigger>
      <DialogContent className={DIALOG}>
        {issued ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("created.title")}</DialogTitle>
              <DialogDescription>{t("created.body", { email: issued.email })}</DialogDescription>
            </DialogHeader>
            <TempPasswordBox password={issued.password} email={issued.email} />
            <DialogFooter>
              <Button type="button" size="lg" onClick={() => { setOpen(false); setIssued(null); }}>{t("done")}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("createTitle")}</DialogTitle>
              <DialogDescription>{t("createHint")}</DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="grid gap-4" noValidate>
              <div className="grid items-start gap-4 sm:grid-cols-2">
                <Field label={t("fields.name")} htmlFor="cu-name" required error={err("name")}>
                  <Input id="cu-name" name="name" required autoComplete="off" {...aria("cu-name", "name")} />
                </Field>
                <Field label={t("fields.email")} htmlFor="cu-email" required error={err("email")}>
                  <Input id="cu-email" name="email" type="email" required autoComplete="off" spellCheck={false} {...aria("cu-email", "email")} />
                </Field>
                <Field label={t("fields.role")} htmlFor="cu-role" required error={err("role")}>
                  <NativeSelect id="cu-role" name="role" defaultValue="TEAM" required {...aria("cu-role", "role")}>
                    {ROLES.filter((r) => canCreateAdmin || r !== "ADMIN").map((r) => <option key={r} value={r}>{te(`Role.${r}`)}</option>)}
                  </NativeSelect>
                </Field>
                <Field label={t("fields.university")} htmlFor="cu-uni" error={err("universityId")}>
                  <NativeSelect id="cu-uni" name="universityId" defaultValue="" {...aria("cu-uni", "universityId")}>
                    <option value="">{t("noUniversity")}</option>
                    {universities.map((u) => <option key={u.id} value={u.id}>{u.shortName} — {u.name}</option>)}
                  </NativeSelect>
                </Field>
              </div>
              <Field label={t("fields.title")} htmlFor="cu-title" hint={t("fields.titleHint")} error={err("title")}>
                <Input id="cu-title" name="title" autoComplete="off" {...aria("cu-title", "title", true)} />
              </Field>
              <p className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
                <KeyRound className="mt-px size-3.5 shrink-0" aria-hidden />
                <span>{t("fields.passwordNote")}</span>
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" size="lg" onClick={() => setOpen(false)}>{tc("actions.cancel")}</Button>
                <SubmitButton pending={pending} pendingLabel={tc("states.loading")}>{tc("actions.create")}</SubmitButton>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type RowUser = { id: string; name: string; email: string; role: (typeof ROLES)[number]; title: string | null; universityId: string | null; active: boolean };

/** Read-only marker for rows the current admin may not manage (root, or coordinators when not root). */
export function LockedRow({ reason }: { reason: "root" | "admin" }) {
  const t = useTranslations("admin.users.root");
  const label = reason === "root" ? t("lockedRoot") : t("lockedAdmin");
  return (
    <span className="inline-grid size-9 place-items-center rounded-lg text-muted-foreground" title={label}>
      <Lock className="size-4" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

function EditUserDialog({ user, universities, isSelf, canGrantAdmin, open, onOpenChange }: {
  user: RowUser; universities: Uni[]; isSelf: boolean; canGrantAdmin: boolean; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations("admin.users");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const { pending, onSubmit, error } = useFormAction<UserActionState>(updateUser, {
    onDone: () => {
      toast.success(tc("states.saved"));
      onOpenChange(false);
    },
    onFail: (s) => {
      if (s.message && !s.errors) toast.error(t(s.message as never));
    },
  });
  const err = (k: string) => (error(k) ? t(error(k) as never) : undefined);
  const id = (k: string) => `eu-${k}-${user.id}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG}>
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>{user.name} · {user.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="id" value={user.id} />
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field label={t("fields.role")} htmlFor={id("role")} required error={err("role")} hint={isSelf ? t("selfRoleNote") : undefined}>
              {isSelf && <input type="hidden" name="role" value={user.role} />}
              <NativeSelect
                id={id("role")} name={isSelf ? undefined : "role"} defaultValue={user.role} disabled={isSelf} aria-invalid={!!err("role")}
                aria-describedby={err("role") ? `${id("role")}-error` : isSelf ? `${id("role")}-hint` : undefined}
              >
                {ROLES.filter((r) => canGrantAdmin || r !== "ADMIN" || user.role === "ADMIN").map((r) => <option key={r} value={r}>{te(`Role.${r}`)}</option>)}
              </NativeSelect>
            </Field>
            <Field label={t("fields.university")} htmlFor={id("uni")} error={err("universityId")}>
              <NativeSelect
                id={id("uni")} name="universityId" defaultValue={user.universityId ?? ""} aria-invalid={!!err("universityId")}
                aria-describedby={err("universityId") ? `${id("uni")}-error` : undefined}
              >
                <option value="">{t("noUniversity")}</option>
                {universities.map((u) => <option key={u.id} value={u.id}>{u.shortName} — {u.name}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <Field label={t("fields.title")} htmlFor={id("title")} hint={t("fields.titleHint")} error={err("title")}>
            <Input
              id={id("title")} name="title" defaultValue={user.title ?? ""} autoComplete="off" aria-invalid={!!err("title")}
              aria-describedby={err("title") ? `${id("title")}-error` : `${id("title")}-hint`}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>{tc("actions.cancel")}</Button>
            <SubmitButton pending={pending} pendingLabel={tc("states.loading")}>{tc("actions.save")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Confirm → generate a temporary password → show it once. */
function ResetPasswordDialog({ user, open, onOpenChange }: { user: RowUser; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("admin.users");
  const tc = useTranslations("common");
  const [issued, setIssued] = useState<Issued | null>(null);
  const [pending, start] = useTransition();
  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) setIssued(null);
  };

  function generate() {
    start(async () => {
      const res = await resetUserPassword({ id: user.id });
      if (res.ok && res.tempPassword && res.email) {
        toast.success(t("toastReset"));
        setIssued({ email: res.email, password: res.tempPassword });
      } else toast.error(t((res.message ?? "errors.error") as never));
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && close(o)}>
      <DialogContent className={DIALOG}>
        <DialogHeader>
          <DialogTitle>{issued ? t("reset.doneTitle", { name: user.name }) : t("reset.title", { name: user.name })}</DialogTitle>
          <DialogDescription>{issued ? t("reset.doneBody") : t("reset.body")}</DialogDescription>
        </DialogHeader>
        {issued && <TempPasswordBox password={issued.password} email={issued.email} />}
        <DialogFooter>
          {issued ? (
            <Button type="button" size="lg" onClick={() => close(false)}>{t("done")}</Button>
          ) : (
            <>
              <Button type="button" variant="outline" size="lg" onClick={() => close(false)} disabled={pending}>{tc("actions.cancel")}</Button>
              <Button type="button" size="lg" onClick={generate} disabled={pending} aria-busy={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
                {pending ? t("reset.pending") : t("reset.confirm")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UserRowActions({ user, universities, isSelf, canGrantAdmin = false, canDelete = false }: { user: RowUser; universities: Uni[]; isSelf: boolean; canGrantAdmin?: boolean; canDelete?: boolean }) {
  const t = useTranslations("admin.users");
  const tc = useTranslations("common");
  const ts = useTranslations("admin.system.user");
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, start] = useTransition();

  function toggle() {
    start(async () => {
      const res = await setUserActive({ id: user.id, active: !user.active });
      setConfirmOpen(false);
      if (res.ok) toast.success(t((res.message ?? "toastActivated") as never));
      else toast.error(t((res.message ?? "errors.error") as never));
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-lg" aria-label={t("actionsFor", { name: user.name })} />}>
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="truncate">{user.name}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil aria-hidden />
            {tc("actions.edit")}
          </DropdownMenuItem>
          {!isSelf && (
            <DropdownMenuItem onClick={() => setResetOpen(true)}>
              <KeyRound aria-hidden />
              {t("resetPassword")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant={user.active ? "destructive" : "default"} disabled={isSelf} onClick={() => setConfirmOpen(true)}>
            {user.active ? <PowerOff aria-hidden /> : <Power aria-hidden />}
            {user.active ? t("deactivate") : t("activate")}
          </DropdownMenuItem>
          {canDelete && !isSelf && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 aria-hidden />
                {ts("menu")}
              </DropdownMenuItem>
            </>
          )}
          {isSelf && <p className="px-1.5 pt-1 pb-1.5 text-xs text-muted-foreground">{t("selfNote")}</p>}
        </DropdownMenuContent>
      </DropdownMenu>

      {canDelete && !isSelf && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className={DIALOG}>
            <DialogHeader>
              <DialogTitle>{ts("title", { name: user.name })}</DialogTitle>
              <DialogDescription>{ts("body")}</DialogDescription>
            </DialogHeader>
            <DeleteUserForm userId={user.id} email={user.email} onDone={() => setDeleteOpen(false)} onCancel={() => setDeleteOpen(false)} />
          </DialogContent>
        </Dialog>
      )}

      <EditUserDialog user={user} universities={universities} isSelf={isSelf} canGrantAdmin={canGrantAdmin} open={editOpen} onOpenChange={setEditOpen} />
      {!isSelf && <ResetPasswordDialog user={user} open={resetOpen} onOpenChange={setResetOpen} />}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{user.active ? t("deactivateTitle", { name: user.name }) : t("activateTitle", { name: user.name })}</AlertDialogTitle>
            <AlertDialogDescription>{user.active ? t("deactivateBody") : t("activateBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{tc("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant={user.active ? "destructive" : "default"} onClick={toggle} disabled={pending} aria-busy={pending}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {user.active ? t("deactivate") : t("activate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
