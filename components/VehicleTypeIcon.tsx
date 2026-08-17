import type { VehicleType } from "@/lib/types";

// One recognizable line-icon per vehicle category, matching the stroke style used
// elsewhere in the app (currentColor, strokeWidth 2, round caps/joins) - used
// wherever a vehicle type used to be shown as a plain text chip/badge (filter rows,
// the CarForm type picker, deck card badges) so it reads at a glance instead of
// needing to parse a label in whichever locale is active.
export default function VehicleTypeIcon({ type, className }: { type: VehicleType; className?: string }) {
  const props = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (type) {
    case "car":
      return (
        <svg {...props}>
          <path d="M3 13l1.5-5A2 2 0 0 1 6.4 6.5h11.2A2 2 0 0 1 19.5 8l1.5 5" />
          <rect x="2.5" y="13" width="19" height="5.5" rx="1.5" />
          <circle cx="7" cy="18.5" r="1.4" fill="currentColor" />
          <circle cx="17" cy="18.5" r="1.4" fill="currentColor" />
        </svg>
      );
    case "motorcycle":
      return (
        <svg {...props}>
          <circle cx="5.5" cy="17" r="2.8" />
          <circle cx="18.5" cy="17" r="2.8" />
          <path d="M8 17h6l3-6h3" />
          <path d="M11 11H8l-2 3" />
          <path d="M14 11l-1.5-3h-2.5" />
        </svg>
      );
    case "scooter":
      return (
        <svg {...props}>
          <circle cx="5" cy="17.5" r="2.3" />
          <circle cx="18" cy="17.5" r="2.3" />
          <path d="M5 17.5h4l2-7h4" />
          <path d="M15 7h3" />
          <path d="M9 17.5h7.5" />
        </svg>
      );
    case "truck":
      return (
        <svg {...props}>
          <path d="M2.5 8.5h10v8h-10z" />
          <path d="M12.5 11.5h4l3 3v2h-7z" />
          <circle cx="6" cy="18.5" r="1.6" fill="currentColor" />
          <circle cx="16.5" cy="18.5" r="1.6" fill="currentColor" />
        </svg>
      );
    case "bus":
      return (
        <svg {...props}>
          <rect x="3" y="5.5" width="18" height="11" rx="1.8" />
          <path d="M3 10.5h18" />
          <path d="M6.5 5.5v5" />
          <path d="M11.5 5.5v5" />
          <path d="M16.5 5.5v5" />
          <circle cx="7" cy="18.5" r="1.4" fill="currentColor" />
          <circle cx="17" cy="18.5" r="1.4" fill="currentColor" />
        </svg>
      );
    case "caravan":
      return (
        <svg {...props}>
          <path d="M3 17V9a1.5 1.5 0 0 1 1.5-1.5H15a2 2 0 0 1 2 2V17" />
          <path d="M17 12h3.5v5H17" />
          <path d="M3 17h17.5" />
          <circle cx="7" cy="18.7" r="1.3" fill="currentColor" />
          <circle cx="14" cy="18.7" r="1.3" fill="currentColor" />
          <path d="M7 10.5h4" />
        </svg>
      );
    case "jet_ski":
      return (
        <svg {...props}>
          <path d="M2.5 15.5c2-4 5-7 9-7 4.5 0 6 3.5 8 3.5 1 0 1.5-.6 2-1.3" />
          <path d="M9 8.5V5.5" />
          <path d="M7 5.5h4" />
          <path d="M2 18.5c1.5 1 3 1 4.5 0 1.5 1 3 1 4.5 0 1.5 1 3 1 4.5 0 1.5 1 3 1 4.5 0" />
        </svg>
      );
    case "atv":
      return (
        <svg {...props}>
          <circle cx="5.5" cy="17" r="2.6" />
          <circle cx="18.5" cy="17" r="2.6" />
          <path d="M8 17h8" />
          <path d="M9 17l1.5-6h3L15 17" />
          <path d="M10.5 11h3" />
          <path d="M10.5 11V8.5" />
          <path d="M8.5 8.5h4" />
        </svg>
      );
    case "boat":
      return (
        <svg {...props}>
          <path d="M3 14h18l-2.5 5a2 2 0 0 1-1.8 1.1H7.3a2 2 0 0 1-1.8-1.1z" />
          <path d="M12 14V4" />
          <path d="M12 4l6 6.5H12" />
          <path d="M12 8.5H8" />
        </svg>
      );
  }
}
