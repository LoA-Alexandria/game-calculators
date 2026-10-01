import { eventGuideHref, type EventGuideId } from "./event-guide-routes.ts";

export type EventTitleTier = "orange" | "purple" | "blue" | "green";

export type EventTitleEvent = {
  /** A published local event guide, when one exists. */
  guideId?: EventGuideId;
  /** The event title as supplied by the community source. */
  name: string;
  /** Reward placement or unlock rule supplied with the title. */
  condition?: string;
  /** A source wording note, such as a spelling variant. */
  note?: string;
};

export type EventTitle = {
  id: string;
  name: string;
  tier: EventTitleTier;
  image?: string;
  events: readonly EventTitleEvent[];
};

const event = (name: string, guideId?: EventGuideId, condition?: string, note?: string): EventTitleEvent => ({
  name,
  ...(guideId ? { guideId } : {}),
  ...(condition ? { condition } : {}),
  ...(note ? { note } : {}),
});

/** Community-reported event title rewards. Conditions are kept with each event. */
export const EVENT_TITLES: readonly EventTitle[] = [
  {
    id: "king-of-the-seven-seas",
    name: "King of the Seven Seas",
    tier: "orange",
    events: [
      event("Atlantis", "atlantis", "Server day 90+"),
      event("Spring Returns", "springReturns", "Top guild leader"),
    ],
  },
  {
    id: "king-of-the-nine-realms",
    name: "King of the Nine Realms",
    tier: "orange",
    image: "/event-titles/king-of-nine-realms.png",
    events: [event("Odin", "trialsOfOdin", "Requires cross-cluster matchmaking")],
  },
  {
    id: "steelheart-overlord",
    name: "Steelheart Overlord",
    tier: "purple",
    image: "/event-titles/steelheart-overlord.png",
    events: [
      event("Atlantis", "atlantis", undefined, "The supplied list spells this ‘Steelheart Overload’ for Atlantis; the screenshot reads Stahlherz-Overlord."),
      event("Spring Returns", "springReturns", "#2 guild leader"),
    ],
  },
  {
    id: "fearless-overlord",
    name: "Fearless Overlord",
    tier: "purple",
    image: "/event-titles/fearless-overlord.png",
    events: [event("Odin", "trialsOfOdin"), event("Duel Festival", "duelFestival")],
  },
  {
    id: "blazing-overlord",
    name: "Blazing Overlord",
    tier: "purple",
    image: "/event-titles/blazing-overlord.png",
    events: [event("Holy Grail", "holyGrail"), event("Astral Wonderland", "astralWonderland")],
  },
  {
    id: "triumphant-overlord",
    name: "Triumphant Overlord",
    tier: "purple",
    image: "/event-titles/triumphant-overlord.png",
    events: [event("Dawn of Rome", "dawnOfRome"), event("Heart of Gold", "heartOfGold")],
  },
  {
    id: "northern-lord",
    name: "Northern Lord",
    tier: "blue",
    image: "/event-titles/northern-lord.png",
    events: [
      event("Atlantis", "atlantis"),
      event("Spring Returns", "springReturns", "#1 guild members reward"),
    ],
  },
  {
    id: "western-lord",
    name: "Western Lord",
    tier: "blue",
    image: "/event-titles/western-lord.png",
    events: [
      event("Holy Grail", "holyGrail"),
      event("Astral Wonderland", "astralWonderland"),
      event("Race to Civilization", undefined, "Available after server day 70"),
    ],
  },
  {
    id: "eastern-lord",
    name: "Eastern Lord",
    tier: "blue",
    image: "/event-titles/eastern-lord.png",
    events: [event("Odin", "trialsOfOdin"), event("Duel Festival", "duelFestival")],
  },
  {
    id: "southern-lord",
    name: "Southern Lord",
    tier: "blue",
    image: "/event-titles/southern-lord.png",
    events: [event("Dawn of Rome", "dawnOfRome"), event("Heart of Gold", "heartOfGold")],
  },
  {
    id: "transport-official",
    name: "Transport Official",
    tier: "green",
    image: "/event-titles/transport-official.png",
    events: [
      event("Atlantis", "atlantis"),
      event("Red Carpet", "redCarpet"),
      event("Spring Returns", "springReturns", "#2 guild members reward"),
      event("Favor of the Gods", undefined, "#1 ranking reward"),
      event("Battlefield Campaign", undefined, "#1 ranking reward"),
    ],
  },
  {
    id: "finance-official",
    name: "Finance Official",
    tier: "green",
    image: "/event-titles/finance-official.png",
    events: [event("Holy Grail", "holyGrail"), event("Astral Wonderland", "astralWonderland"), event("Peak of Enlightenment", "peakOfEnlightenment")],
  },
  {
    id: "city-official",
    name: "City Official",
    tier: "green",
    image: "/event-titles/city-official.png",
    events: [
      event("Odin", "trialsOfOdin"),
      event("Goddess of Time", "goddessOfTime"),
      event("Divine Grace (Egypt Tales unlock event)", undefined, "Prayer count ranking · #1"),
    ],
  },
  {
    id: "justice-official",
    name: "Justice Official",
    tier: "green",
    image: "/event-titles/justice-official.png",
    events: [
      event("Duel Festival", "duelFestival"),
      event("Monument of Eternity", "monumentOfEternity"),
      event("Glorious Civilization", undefined, "#1 ranking reward"),
      event("Regatta (Grand Voyage)", "globalRegatta", "Ranking event · requires server day 120"),
    ],
  },
  {
    id: "military-official",
    name: "Military Official",
    tier: "green",
    image: "/event-titles/military-official.png",
    events: [
      event("Dawn of Rome", "dawnOfRome"),
      event("Legend of Serenissima", "legendOfSerenissima"),
      event("Heart of Gold", "heartOfGold"),
    ],
  },
];

/** Events whose green title colour was included, but whose name was omitted in the source. */
export const UNNAMED_GREEN_TITLE_EVENTS = [
  event("Civilization Evolution", "evolutionInstitute"),
  event("Race to Civilization"),
] as const;

export function eventTitleHref(event: EventTitleEvent): string {
  return event.guideId ? eventGuideHref(event.guideId) : "/events/";
}
