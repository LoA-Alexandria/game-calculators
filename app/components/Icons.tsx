/**
 * Original line icons drawn for this site. Deliberately simple geometry in the
 * visual language of the setting (sun disc, river, papyrus, surveyed field)
 * rather than anything traced from the game.
 */
type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

/** Sun disc over two river lines — the site mark. */
export function BrandMark({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="9" r="4.2" fill="currentColor" opacity=".95" />
      <path
        d="M3 16.4c1.8 0 1.8 1.5 3.6 1.5s1.8-1.5 3.6-1.5 1.8 1.5 3.6 1.5 1.8-1.5 3.6-1.5 1.8 1.5 3.6 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity=".75"
      />
      <path
        d="M3 20c1.8 0 1.8 1.5 3.6 1.5s1.8-1.5 3.6-1.5 1.8 1.5 3.6 1.5 1.8-1.5 3.6-1.5 1.8 1.5 3.6 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity=".4"
      />
    </svg>
  );
}

/** A rolled papyrus sheet. */
export function NewsIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6" />
      <path d="M6 4a2 2 0 0 0-2 2v1h2" />
      <path d="M6 20a2 2 0 0 0 2-2V6" />
      <path d="M11 9h5M11 13h5M11 17h3" />
    </svg>
  );
}

/** An opened tablet with a reading rule. */
export function GuidesIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5a2.5 2.5 0 0 1 2.5 2z" />
      <path d="M12 3v17" />
    </svg>
  );
}

/** A counting board. */
export function CalculatorsIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <path d="M8 7.5h8" />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" strokeWidth="2.2" />
    </svg>
  );
}

/** A surveyed field with one marked plot. */
export function SimulationsIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" opacity=".65" />
      <rect x="9" y="9" width="6" height="6" fill="currentColor" stroke="none" opacity=".55" />
    </svg>
  );
}

export function HomeIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.8V20h12V9.8" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

export function DiscordIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M8.5 16.5C7 16.2 5.8 15.6 5 14.8c.3-4 1.4-6.8 2.4-7.8 1-.7 2-.9 2-.9l.6 1.2a11 11 0 0 1 4 0L14.6 6s1 .2 2 .9c1 1 2.1 3.8 2.4 7.8-.8.8-2 1.4-3.5 1.7" />
      <path d="M8.5 16.5 7.6 18.6a.6.6 0 0 0 .7.8c1.3-.3 2.5-.8 3.7-.8s2.4.5 3.7.8a.6.6 0 0 0 .7-.8l-.9-2.1" />
      <path d="M10 12.2h.01M14 12.2h.01" strokeWidth="2.4" />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function SunIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </svg>
  );
}

export function MoonIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M20 13.5A8 8 0 0 1 10.5 4a8 8 0 1 0 9.5 9.5z" />
    </svg>
  );
}

export function GlobeIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9.5h17M3.5 14.5h17" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
    </svg>
  );
}

/** Three overlapping discs — a palette, not a brand mark. */
export function PaletteIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="9" cy="10" r="5" />
      <circle cx="15" cy="10" r="5" />
      <circle cx="12" cy="15" r="5" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
    </svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M12 3l7 2.8v5.4c0 4.2-2.9 7.6-7 8.8-4.1-1.2-7-4.6-7-8.8V5.8z" />
      <path d="M9.2 12.1l1.9 1.9 3.7-3.9" />
    </svg>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 20c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2" />
      <path d="M16 5.6a3.2 3.2 0 0 1 0 6M17.5 14.9c2 .6 3.5 2.5 3.5 5.1" />
    </svg>
  );
}

export function KeyIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="8" cy="14" r="4" />
      <path d="M11 11.5 20 3M17 4.6l2.4 2.4M15 6.6l2.4 2.4" />
    </svg>
  );
}

export function PlugIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M9 3v5M15 3v5" />
      <path d="M6 8h12v2.5a6 6 0 0 1-12 0z" />
      <path d="M12 16.5V21" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M4 7h16M9.5 7V4.5h5V7M6 7l.9 12.2A1.8 1.8 0 0 0 8.7 21h6.6a1.8 1.8 0 0 0 1.8-1.8L18 7" />
      <path d="M10.5 11v6M13.5 11v6" />
    </svg>
  );
}

export function UploadIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M12 16V4" />
      <path d="M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
    </svg>
  );
}

/** Six dots: a drag handle. */
export function GripIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="9" cy="6" r="1.2" />
      <circle cx="15" cy="6" r="1.2" />
      <circle cx="9" cy="12" r="1.2" />
      <circle cx="15" cy="12" r="1.2" />
      <circle cx="9" cy="18" r="1.2" />
      <circle cx="15" cy="18" r="1.2" />
    </svg>
  );
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />
    </svg>
  );
}

export function CopyIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 6.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h.5" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M5 12.5 9.5 17 19 7" />
    </svg>
  );
}

export function InfoIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.8h.01" strokeWidth="2.2" />
    </svg>
  );
}

export function AlertIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M12 4.2 21 19.5H3z" />
      <path d="M12 10v4" />
      <path d="M12 16.8h.01" strokeWidth="2.2" />
    </svg>
  );
}

export function PenIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M4 20h4L20 8l-4-4L4 16z" />
      <path d="M14.5 5.5 18.5 9.5" />
    </svg>
  );
}

/** Chevron for the collapsible sidebar sections; CSS rotates it when open. */
export function ChevronIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M9 5.5 15.5 12 9 18.5" />
    </svg>
  );
}

/** A month page with a marked day. */
export function EventsIcon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3.5V6M16 3.5V6" />
      <rect x="7" y="13" width="3.4" height="3.2" rx=".7" fill="currentColor" stroke="none" />
    </svg>
  );
}

export const SECTION_ICONS = {
  news: NewsIcon,
  events: EventsIcon,
  guides: GuidesIcon,
  calculators: CalculatorsIcon,
  simulations: SimulationsIcon,
} as const;
