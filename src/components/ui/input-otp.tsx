import * as React from "react";

import { cn } from "@/lib/utils";

const InputOTP = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    maxLength?: number;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  }
>(({ className, maxLength = 6, value, onChange, disabled, ...props }, ref) => {
  const handleChange = (next: string) => {
    const sanitized = next.replace(/\D/g, "").slice(0, maxLength);
    onChange(sanitized);
  };

  return (
    <div
      ref={ref}
      data-slot="input-otp"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    >
      <input
        aria-hidden
        tabIndex={-1}
        className="sr-only"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
      />
      <div className="flex items-center">
        <input
          type="text"
          inputMode="numeric"
          pattern="\d*"
          className="sr-only"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
        />
      </div>
    </div>
  );
});
InputOTP.displayName = "InputOTP";

const InputOTPGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="input-otp-group"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  ),
);
InputOTPGroup.displayName = "InputOTPGroup";

const InputOTPSlot = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    index: number;
    value?: string;
    onChange?: (value: string) => void;
    disabled?: boolean;
  }
>(({ className, index, value = "", onChange, disabled, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="input-otp-slot"
    className={cn(
      "flex h-12 w-10 items-center justify-center rounded-md border border-input bg-background text-lg font-semibold tracking-widest",
      disabled && "opacity-50",
      className,
    )}
    role="textbox"
    aria-label={`Digit ${index + 1}`}
    tabIndex={disabled ? -1 : 0}
    onKeyDown={(event) => {
      if (disabled) return;
      if (event.key === "Backspace") {
        onChange?.("");
        event.preventDefault();
        return;
      }
      if (/^\d$/.test(event.key)) {
        onChange?.(event.key);
        event.preventDefault();
      }
    }}
    {...props}
  >
    {value}
  </div>
));
InputOTPSlot.displayName = "InputOTPSlot";

export { InputOTP, InputOTPGroup, InputOTPSlot };
