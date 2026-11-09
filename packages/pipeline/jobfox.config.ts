import { defineConfig } from "./src/core/config.ts";

const roles = [
  "full stack engineer",
  "frontend engineer",
  "react developer",
  "typescript engineer",
  "cloud engineer",
  "solutions engineer",
  "forward deployed engineer",
  // Banks, insurers, hospitals, and media companies often title the same work this way.
  "application developer",
];

// Roles that mix building with client contact, roughly half coding. No sales
// engineer: those usually carry a quota.
const adjacentRoles = [
  "implementation engineer",
  "integration engineer",
  "deployment engineer",
  "professional services engineer",
  "technical consultant",
  "customer engineer",
  "creative technologist",
];

// Creative and 3D web work, where my Blender experience counts. Technical
// artist is mostly games, so it's the longest shot.
const creativeRoles = [
  "creative developer",
  "webgl developer",
  "three.js developer",
  "3d web developer",
  "technical artist",
];

// Hands-on work outside software. On-site by nature, so searched near NYC only.
const nonTechRoles = [
  "av programmer",
  "audio visual engineer",
  "show control",
  "exhibit technician",
  "project coordinator",
  "customer onboarding",
  "technical trainer",
  "field technician",
  "installation technician",
  "video production",
  "audio engineer",
  "fabricator",
];

// Everything else I'd consider, searched by name because Adzuna needs keywords.
const broadRoles = [
  "operations coordinator",
  "customer success",
  "customer support",
  "business analyst",
  "data analyst",
  "it support",
  "qa tester",
  "technical writer",
  "administrative assistant",
  "marketing coordinator",
];

export default defineConfig({
  adzuna: {
    country: "us",
    // Each search costs up to maxPagesPerSearch requests. The free tier has
    // daily and monthly caps, so check your usage at developer.adzuna.com.
    searches: [
      // ~40 km around Manhattan covers Jersey City, Hoboken, and Newark.
      ...[...roles, ...adjacentRoles, ...creativeRoles, ...broadRoles].map((what) => ({
        what,
        where: "New York",
        distanceKm: 40,
      })),
      ...[...roles, ...adjacentRoles, ...creativeRoles, ...broadRoles].map((what) => ({
        what: `${what} remote`,
      })),
      ...nonTechRoles.map((what) => ({ what, where: "New York", distanceKm: 40 })),
    ],
    maxDaysOld: 14,
    resultsPerPage: 50,
    maxPagesPerSearch: 2,
  },

  hn: { enabled: true },

  // Remote contract roles. Adzuna's contract listings are thin, and Himalayas labels
  // employment type on every job. Up to 2 requests per search, once per run.
  himalayas: {
    searches: [...roles, ...adjacentRoles, ...creativeRoles, ...broadRoles],
    employmentType: "Contractor",
  },

  scoring: {
    model: "claude-haiku-5-5",
    effort: "medium",
    maxJobsPerRun: 400,
    concurrency: 4,
    // An example. My real preferences, including pay, live in data/preferences.md
    // (gitignored), which replaces this when it exists. One preference per line.
    preferences: [
      "Mid-level roles: full-stack, frontend, or solutions engineering.",
      "On-site or hybrid near my city, or remote within my country.",
      "Strongest in TypeScript, React, Node.js, and Postgres.",
      "Pay: a stated range that tops out below my minimum is a poor fit.",
      "Not looking for staff/principal/management roles, or roles centered on a stack I haven't used.",
    ].join("\n"),
    // Tuned on my first eval (11 labels): every job I called strong scored 62+, and
    // every possible/weak one 22-42. Revisit as labels accumulate.
    strongThreshold: 60,
    possibleThreshold: 35,
  },

  drafting: {
    model: "claude-sonnet-5-5",
    effort: "medium",
  },

  filters: {
    // Any title gets in and scoring ranks it, except work I've ruled out. Specific phrases
    // on purpose: bare "sales" or "server" would also catch Sales Ops and SQL Server roles.
    titleExclude: [
      // Commission or quota sales.
      "sales representative",
      "sales rep",
      "sales executive",
      "sales consultant",
      "sales engineer",
      "sales development",
      "inside sales",
      "outside sales",
      "account executive",
      "business development representative",
      "commission",
      // Food service.
      "barista",
      "bartender",
      "busser",
      "cashier",
      "chef",
      "cook",
      "dishwasher",
      "food runner",
      "food server",
      "food service",
      "hostess",
      "restaurant server",
      "waiter",
      "waitress",
      // Retail stores.
      "crew member",
      "retail associate",
      "retail sales",
      "sales associate",
      "stock associate",
      "store associate",
      "store manager",
    ],
    // Whole-word matches. Avoid bare "ny": it would also match Albany, NY.
    locations: [
      "new york",
      "nyc",
      "manhattan",
      "brooklyn",
      "jersey city",
      "hoboken",
      "newark",
      "new jersey",
      "nj",
    ],
    remoteOk: true,
    remoteUsOnly: true,
    remoteExcludedRegions: [
      "europe",
      "emea",
      "uk",
      "united kingdom",
      "london",
      "canada",
      "latam",
      "apac",
      "india",
      "germany",
    ],
    seniorityExclude: [
      "staff",
      "principal",
      "director",
      "vp",
      "vice president",
      "head of",
      "distinguished",
      "fellow",
      "manager",
      "intern",
      "internship",
      // "senior",  // uncomment to keep strictly to mid-level titles
    ],
    // Companies I never want to see. Matched after normalizing ("Acme, Inc." = "acme").
    companyBlocklist: [],
  },
});
