"use client";

import { forwardRef, useId, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";
import { EyeIcon, EyeOffIcon } from "@/components/icons";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Optional leading icon (decorative; the visible label carries the name). */
  icon?: ReactNode;
  /** Validation message shown below the field. */
  error?: string;
  /** Enables the built-in show/hide-password toggle. */
  passwordToggle?: boolean;
  hint?: ReactNode;
}

/**
 * The app-wide text input: 48px target, leading icon slot, inline validation.
 * The label is always visible (accessibility) — not a floating placeholder.
 */
export const Input = forwardRef<HTMLInputElement, TextFieldProps>(function Input(
  { label, icon, error, passwordToggle, hint, className, type, ...props },
  ref
) {
  const [show, setShow] = useState(false);
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const errorId = `${id}-error`;
  const inputType = passwordToggle ? (show ? "text" : "password") : (type ?? "text");

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
      </label>
      <div
        className={cn(
          "relative rounded-xl border bg-white shadow-xs transition-colors",
          error ? "border-rose-400" : "border-slate-200 focus-within:border-brand-600"
        )}
      >
        {icon ? (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            {icon}
          </span>
        ) : null}
        <input
          ref={ref}
          id={id}
          type={inputType}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "block w-full rounded-xl border-0 bg-transparent py-3 pr-4 pl-11 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none",
            !icon && "pl-4",
            passwordToggle && !icon && "pr-11"
          )}
          {...props}
        />
        {passwordToggle ? (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-slate-600"
          >
            {show ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
        ) : null}
      </div>
      {hint && !error ? <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{hint}</p> : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-[11px] font-medium text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
});
