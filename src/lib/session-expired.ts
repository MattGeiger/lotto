import { toast } from "sonner";

/**
 * ASK-compliant message surfaced when an admin action fails because the
 * NextAuth JWT has expired. The raw middleware response is `Unauthorized`,
 * which is not Actionable, Specific, or Kind; callers should map 401
 * responses to this copy instead of echoing the server string.
 */
export const SESSION_EXPIRED_MESSAGE =
  "Your sign-in expired. Sign back in to keep working.";

/**
 * Error thrown from fetch helpers when the API returns 401. Distinct class
 * lets the admin action dispatcher decide between the ASK toast and the
 * generic error path.
 */
export class SessionExpiredError extends Error {
  constructor(message: string = SESSION_EXPIRED_MESSAGE) {
    super(message);
    this.name = "SessionExpiredError";
  }
}

const buildCallbackUrl = () => {
  if (typeof window === "undefined") return "/admin";
  return `${window.location.pathname}${window.location.search}`;
};

/**
 * Fires a sonner error toast with a Sign-in action button preserving the
 * caller's current path as the callback URL.
 */
export function showSessionExpiredToast() {
  const callbackUrl = buildCallbackUrl();
  toast.error(SESSION_EXPIRED_MESSAGE, {
    duration: 10_000,
    action: {
      label: "Sign in",
      onClick: () => {
        if (typeof window === "undefined") return;
        window.location.href = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
      },
    },
  });
}
