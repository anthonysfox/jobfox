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

// Hands-on work outside software. On-site by nature, so searched near NYC only.
const nonTechRoles = [
  "av programmer",
  "audio visual engineer",
  "show control",
  "exhibit technician",
  "project coordinator",
  "customer onboarding",
  "technical trainer",
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
      ...nonTechRoles.map((what) => ({ what, where: "New York", distanceKm: 40 })),
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
      "Also open to roles that mix building with client contact, roughly half coding: implementation, integration, deployment, professional services, customer engineering, technical consulting, or creative technologist.",
      "I want to be hands-on, building things myself (UI, integrations, prototypes, customer deployments), more than advising, documenting, or managing.",
      "Avoid roles with a sales quota or commission-based pay.",
      "Any industry: finance, healthcare, media, retail, and government are as welcome as tech companies.",
      "A plus, not a requirement: music and media, AI tools and agents, construction tech, or cameras and IoT.",
      "Also open to hands-on work outside software: AV and systems integration (especially AV programming), show control, exhibits and installations, project coordination, and customer onboarding or training. For these, weigh transferable experience: client contact, demos, onboarding people, leading a migration, and building things that come together.",
      "Pay: a stated range that tops out below my minimum is a poor fit.",
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
      "ux engineer",
      "web engineer",
      "creative technologist",
      "design technologist",
      // Client-facing technical roles.
      "solution engineer",
      "solution consultant",
      "solutions consultant",
      "implementation engineer",
      "implementation consultant",
      "implementation specialist",
      "integration engineer",
      "integrations engineer",
      "deployment engineer",
      "professional services engineer",
      "developer advocate",
      "developer relations engineer",
      "technical consultant",
      "customer engineer",
      "support engineer",
      // Hands-on work outside software.
      "av programmer",
      "av engineer",
      "av technician",
      "av integration",
      "audio visual",
      "audiovisual",
      "crestron",
      "show control",
      "exhibit technician",
      "exhibit fabricator",
      "project coordinator",
      "onboarding specialist",
      "customer onboarding",
      "technical trainer",
      "training specialist",
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
