"use client";

import * as React from "react";
import { isValidElement } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, type ButtonProps } from "@/components/ui/button";

type ConfirmActionProps = {
  title: string;
  description: string;
  actionLabel?: string;
  confirmText?: string;
  onConfirm: () => Promise<void> | void;
  disabled?: boolean;
  triggerLabel?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  triggerTitle?: string;
  children?: React.ReactNode;
};

export const ConfirmAction: React.FC<ConfirmActionProps> = ({
  title,
  description,
  actionLabel,
  confirmText,
  onConfirm,
  disabled,
  triggerLabel,
  variant,
  size,
  triggerTitle,
  children,
}) => {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const confirmationLabel = confirmText ?? actionLabel ?? "Confirm";

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {children ? (
          isValidElement(children) ? (
            React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
              disabled,
            })
          ) : (
            <span>{children}</span>
          )
        ) : (
          <Button variant={variant} size={size} disabled={disabled} title={triggerTitle}>
            {triggerLabel}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={busy}>
            {busy ? "Working..." : confirmationLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
