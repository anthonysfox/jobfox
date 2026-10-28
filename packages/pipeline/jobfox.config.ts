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

// Client-facing technical roles my EarthCam work supports.
const adjacentRoles = [
  "implementation engineer",
  "integration engineer",
  "technical consultant",
  "customer engineer",
  "sales engineer",
];

export default defineConfig({
  adzuna: {
    country: "us",
    // Each search costs up to maxPagesPerSearch requests. The free tier has
    // daily and monthly caps, so check your usage at developer.adzuna.com.
    searches: [
      // ~40 km around Manhattan covers Jersey City, Hoboken, and Newark.
      ...[...roles, ...adjacentRoles].map((what) => ({ what, where: "New York", distanceKm: 40 })),
      ...[...roles, ...adjacentRoles].map((what) => ({ what: `${what} remote` })),
    ],
    maxDaysOld: 14,
    resultsPerPage: 50,
    maxPagesPerSearch: 2,
  },

  hn: { enabled: true },

  scoring: {
    model: "claude-haiku-5-5",
    effort: "medium",
    maxJobsPerRun: 400,
    concurrency: 4,
    preferences: [
      "Mid-level roles: full-stack, frontend, cloud, solutions engineer, or forward-deployed engineer.",
      "Also open to client-facing technical roles: implementation, integration, technical consulting, customer engineering, sales engineering, or technical support engineering.",
      "Any industry: finance, healthcare, media, retail, and government are as welcome as tech companies.",
      "On-site or hybrid in the NYC / Northern NJ area, or remote within the US.",
      "Strongest in TypeScript, React, Next.js, Node.js, Prisma, and Postgres; AWS Solutions Architect Associate.",
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
    titleKeywords: [
      "full stack",
      "frontend",
      "software engineer",
      "software developer",
      "web developer",
      "product engineer",
      "react",
      "typescript",
      "javascript",
      "node",
      "cloud engineer",
      "cloud developer",
      "solutions engineer",
      "solutions architect",
      "forward deployed",
      // The same work at non-tech employers.
      "application developer",
      "applications developer",
      "programmer analyst",
      "software development engineer",
      "ui developer",
      "ui engineer",
      "web engineer",
      // Client-facing technical roles.
      "solution engineer",
      "solution consultant",
      "solutions consultant",
      "sales engineer",
      "implementation engineer",
      "implementation consultant",
      "implementation specialist",
      "integration engineer",
      "integrations engineer",
      "technical consultant",
      "customer engineer",
      "support engineer",
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
