import { format } from "date-fns";

interface DateStampProps {
  date: Date | string | null | undefined;
  /** Size variant: "sm" for grid thumbnails, "md" for feed/viewer */
  size?: "sm" | "md";
}

/**
 * Retro camera date stamp — amber LED digits like a 90s disposable camera.
 * Format: 'YY  MM  DD
 */
export function DateStamp({ date, size = "md" }: DateStampProps) {
  if (!date) return null;

  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;

  const stamp = `'${format(d, "yy")}  ${format(d, "MM")}  ${format(d, "dd")}`;

  const fontSize = size === "sm" ? "8px" : "12px";

  return (
    <span
      className="date-stamp pointer-events-none select-none"
      style={{ fontSize }}
      aria-hidden="true"
    >
      {stamp}
    </span>
  );
}
