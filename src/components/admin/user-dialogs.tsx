"use client";
import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Pencil, Power, PowerOff, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, NativeSelect } from "@/components/shared/form";
import { createUser, setUserActive, updateUser, type UserFormState } from "@/app/(app)/admin/users/actions";

const ROLES = ["ADMIN", "TEAM", "MENTOR", "JURY"] as const;
type Uni = { id: string; shortName: string; name: string };

/** Submit via onSubmit + transition so React does not auto-reset the form when validation fails. */
function useSubmitWith(dispatch: (fd: FormData) => void) {
  const [, startSubmit] = useTransition();
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startSubmit(() => dispatch(fd));
  };
}

function PendingButton({ pending, children, pendingLabel }: { pending: boolean; children: React.ReactNode; pendingLabel: string }) {
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? pendingLabel : children}
    </Button>
  );
}

function useFieldError(state: UserFormState) {
  const t = useTranslations("admin.users.errors");
  return (k: string) => {
    if (!state || state.ok || !state.fields) return undefined;
    const code = state.fields[k as keyof typeof state.fields];
    return code ? t(code as never) : undefined;
  };
}

export function CreateUserDialog({ universities }: { universities: Uni[] }) {
  const t = useTranslations("admin.users");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(async (prev: UserFormState, fd: FormData) => {
    const res = await createUser(prev, fd);
    if (res?.ok) {
      toast.success(t("toastCreated"));
      setOpen(false);
    } else if (res?.error) {
      toast.error(t(`errors.${res.error}`));
    }
    return res;
  }, undefined);
  const err = useFieldError(state);
  const onSubmit = useSubmitWith(action);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" className="h-10" />}>
        <UserPlus className="size-4" aria-hidden />
        {t("create")}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
          <DialogDescription>{t("createHint")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="content-start" label={t("fields.name")} htmlFor="cu-name" required error={err("name")}>
              <Input id="cu-name" name="name" required autoComplete="off" aria-invalid={!!err("name")} aria-describedby={err("name") ? "cu-name-error" : undefined} />
            </Field>
            <Field className="content-start" label={t("fields.email")} htmlFor="cu-email" required error={err("email")}>
              <Input id="cu-email" name="email" type="email" required autoComplete="off" aria-invalid={!!err("email")} aria-describedby={err("email") ? "cu-email-error" : undefined} />
            </Field>
            <Field className="content-start" label={t("fields.role")} htmlFor="cu-role" required error={err("role")}>
              <NativeSelect id="cu-role" name="role" defaultValue="TEAM" required aria-invalid={!!err("role")} aria-describedby={err("role") ? "cu-role-error" : undefined}>
                {ROLES.map((r) => <option key={r} value={r}>{te(`Role.${r}`)}</option>)}
              </NativeSelect>
            </Field>
            <Field className="content-start" label={t("fields.university")} htmlFor="cu-uni" error={err("universityId")}>
              <NativeSelect id="cu-uni" name="universityId" defaultValue="" aria-invalid={!!err("universityId")} aria-describedby={err("universityId") ? "cu-uni-error" : undefined}>
                <option value="">{t("noUniversity")}</option>
                {universities.map((u) => <option key={u.id} value={u.id}>{u.shortName} — {u.name}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <Field label={t("fields.title")} htmlFor="cu-title" hint={t("fields.titleHint")} error={err("title")}>
            <Input id="cu-title" name="title" autoComplete="off" aria-invalid={!!err("title")} aria-describedby={err("title") ? "cu-title-error" : "cu-title-hint"} />
          </Field>
          <Field label={t("fields.password")} htmlFor="cu-password" required hint={t("fields.passwordHint")} error={err("password")}>
            <Input id="cu-password" name="password" defaultValue="Demo2026!" required autoComplete="new-password" aria-invalid={!!err("password")} aria-describedby={err("password") ? "cu-password-error" : "cu-password-hint"} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{tc("actions.cancel")}</Button>
            <PendingButton pending={isPending} pendingLabel={tc("states.loading")}>{tc("actions.create")}</PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type RowUser = { id: string; name: string; email: string; role: (typeof ROLES)[number]; title: string | null; universityId: string | null; active: boolean };

export function UserRowActions({ user, universities, isSelf }: { user: RowUser; universities: Uni[]; isSelf: boolean }) {
  const t = useTranslations("admin.users");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, start] = useTransition();
  const [state, action, isPending] = useActionState(async (prev: UserFormState, fd: FormData) => {
    const res = await updateUser(prev, fd);
    if (res?.ok) {
      toast.success(tc("states.saved"));
      setEditOpen(false);
    } else if (res?.error) {
      toast.error(t(`errors.${res.error}`));
    }
    return res;
  }, undefined);
  const err = useFieldError(state);
  const onSubmit = useSubmitWith(action);

  function toggle() {
    start(async () => {
      const res = await setUserActive({ id: user.id, active: !user.active });
      setConfirmOpen(false);
      if (res.ok) toast.success(user.active ? t("toastDeactivated") : t("toastActivated"));
      else toast.error(t(`errors.${res.error ?? "error"}`));
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={t("actionsFor", { name: user.name })} />}>
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="truncate">{user.name}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil aria-hidden />
            {tc("actions.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant={user.active ? "destructive" : "default"}
            disabled={isSelf}
            onClick={() => setConfirmOpen(true)}
          >
            {user.active ? <PowerOff aria-hidden /> : <Power aria-hidden />}
            {user.active ? t("deactivate") : t("activate")}
          </DropdownMenuItem>
          {isSelf && <p className="px-1.5 pt-1 pb-1.5 text-xs text-muted-foreground">{t("selfNote")}</p>}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
            <DialogDescription>{user.name} · {user.email}</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <input type="hidden" name="id" value={user.id} />
            <Field label={t("fields.role")} htmlFor={`eu-role-${user.id}`} required error={err("role")} hint={isSelf ? t("selfRoleNote") : undefined}>
              {isSelf && <input type="hidden" name="role" value={user.role} />}
              <NativeSelect id={`eu-role-${user.id}`} name={isSelf ? undefined : "role"} defaultValue={user.role} disabled={isSelf} aria-invalid={!!err("role")} aria-describedby={err("role") ? `eu-role-${user.id}-error` : isSelf ? `eu-role-${user.id}-hint` : undefined}>
                {ROLES.map((r) => <option key={r} value={r}>{te(`Role.${r}`)}</option>)}
              </NativeSelect>
            </Field>
            <Field label={t("fields.title")} htmlFor={`eu-title-${user.id}`} error={err("title")}>
              <Input id={`eu-title-${user.id}`} name="title" defaultValue={user.title ?? ""} autoComplete="off" aria-invalid={!!err("title")} aria-describedby={err("title") ? `eu-title-${user.id}-error` : undefined} />
            </Field>
            <Field label={t("fields.university")} htmlFor={`eu-uni-${user.id}`} error={err("universityId")}>
              <NativeSelect id={`eu-uni-${user.id}`} name="universityId" defaultValue={user.universityId ?? ""} aria-invalid={!!err("universityId")} aria-describedby={err("universityId") ? `eu-uni-${user.id}-error` : undefined}>
                <option value="">{t("noUniversity")}</option>
                {universities.map((u) => <option key={u.id} value={u.id}>{u.shortName} — {u.name}</option>)}
              </NativeSelect>
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>{tc("actions.cancel")}</Button>
              <PendingButton pending={isPending} pendingLabel={tc("states.loading")}>{tc("actions.save")}</PendingButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
