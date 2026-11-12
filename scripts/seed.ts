// POLLY seed — demo dataset.
// Fictional wire services and sponsors by design: this is demo data,
// replaced by real feeds + Supabase in production.
// Deterministic PRNG so the demo is reproducible.

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Seeded LCG for reproducible "randomness"
let seedState = 42;
function rnd(): number {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}
const DAYS = 24 * 60 * 60 * 1000;
const now = Date.now();
const ago = (d: number) => new Date(now - d * DAYS);

async function main() {
  console.log("Clearing existing data...");
  await db.follow.deleteMany();
  await db.rewardTransaction.deleteMany();
  await db.pollResponse.deleteMany();
  await db.pollOption.deleteMany();
  await db.poll.deleteMany();
  await db.sponsor.deleteMany();
  await db.comment.deleteMany();
  await db.happening.deleteMany();
  await db.userInterest.deleteMany();
  await db.topic.deleteMany();
  await db.user.deleteMany();

  console.log("Seeding topics...");
  const topicDefs = [
    { slug: "transit", label: "Transit & Infrastructure", emoji: "🚇" },
    { slug: "housing", label: "Housing", emoji: "🏘️" },
    { slug: "education", label: "Education", emoji: "🎓" },
    { slug: "elections", label: "Elections & Voting", emoji: "🗳️" },
    { slug: "economy", label: "Economy & Jobs", emoji: "💼" },
    { slug: "public-safety", label: "Public Safety", emoji: "🚨" },
    { slug: "energy-climate", label: "Energy & Climate", emoji: "⚡" },
    { slug: "healthcare", label: "Healthcare", emoji: "🏥" },
    { slug: "tech-privacy", label: "Tech & Privacy", emoji: "🔒" },
  ];
  const topics: Record<string, { id: string; slug: string; label: string; emoji: string | null }> =
    {};
  for (const t of topicDefs) {
    const created = await db.topic.create({ data: t });
    topics[t.slug] = { ...created, emoji: created.emoji };
  }

  console.log("Seeding users...");
  // The demo member — signed in via any method lands here.
  const maya = await db.user.create({
    data: {
      handle: "maya",
      displayName: "Maya R.",
      accountType: "MEMBER",
      metro: "Chicago",
      stateCode: "IL",
      ageBracket: "25-34",
      genderBucket: "F",
      points: 1240,
      sweepstakesEntries: 14,
      revShareCents: 87,
      tier: "VOICED",
      followerCount: 212,
      pollsAnswered: 9,
      commentsPosted: 4,
    },
  });

  // Creator channel owner — CREATOR sampling mode delivers polls
  // through accounts like this one to their follower graph.
  const rio = await db.user.create({
    data: {
      handle: "rio",
      displayName: "Rio Marlow",
      accountType: "MEMBER",
      isCreator: true,
      metro: "Chicago",
      stateCode: "IL",
      ageBracket: "35-44",
      genderBucket: "M",
      points: 15200,
      sweepstakesEntries: 40,
      revShareCents: 21400,
      tier: "FLOCK_LEADER",
      followerCount: 4820,
      pollsAnswered: 31,
      commentsPosted: 112,
    },
  });

  // Guest identity for limited guest mode.
  await db.user.create({
    data: {
      handle: "guest_demo",
      displayName: "Guest",
      accountType: "GUEST",
    },
  });

  // Neighbor users for feed commentary.
  const neighborDefs = [
    { handle: "danielk", displayName: "Daniel K.", metro: "Chicago", stateCode: "IL", ageBracket: "35-44", genderBucket: "M", points: 3200, tier: "WEATHERED", followerCount: 890 },
    { handle: "priya_reads", displayName: "Priya S.", metro: "Chicago", stateCode: "IL", ageBracket: "25-34", genderBucket: "F", points: 780, tier: "VOICED", followerCount: 156 },
    { handle: "windycityted", displayName: "Ted W.", metro: "Chicago", stateCode: "IL", ageBracket: "55-64", genderBucket: "M", points: 540, tier: "VOICED", followerCount: 64 },
    { handle: "angela_oakpark", displayName: "Angela M.", metro: "Chicago", stateCode: "IL", ageBracket: "45-54", genderBucket: "F", points: 11800, tier: "FLOCK_LEADER", followerCount: 2100 },
    { handle: "columbusjoe", displayName: "Joe B.", metro: "Columbus", stateCode: "OH", ageBracket: "45-54", genderBucket: "M", points: 210, tier: "HATCHLING", followerCount: 12 },
    { handle: "desertdawn", displayName: "Dawn L.", metro: "Phoenix", stateCode: "AZ", ageBracket: "65+", genderBucket: "F", points: 4200, tier: "WEATHERED", followerCount: 340 },
    { handle: "motorcitymara", displayName: "Mara J.", metro: "Detroit", stateCode: "MI", ageBracket: "18-24", genderBucket: "NB", points: 95, tier: "HATCHLING", followerCount: 29 },
    { handle: "clevlandray", displayName: "Ray T.", metro: "Cleveland", stateCode: "OH", ageBracket: "35-44", genderBucket: "M", points: 2650, tier: "WEATHERED", followerCount: 410 },
  ];
  const neighbors: Record<string, string> = {};
  for (const n of neighborDefs) {
    const u = await db.user.create({ data: { ...n, accountType: "MEMBER" } });
    neighbors[n.handle] = u.id;
  }

  // Synthetic respondent pool for realistic weighted results.
  const ages = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
  const genders = ["F", "M", "F", "M", "F", "M", "NB"];
  const metrosPool = ["Chicago", "Columbus", "Phoenix", "Detroit", "Cleveland", "Cincinnati"];
  const pool: { id: string; age: string; gender: string; metro: string }[] = [];
  for (let i = 0; i < 130; i++) {
    const u = await db.user.create({
      data: {
        handle: `resp_${String(i).padStart(4, "0")}`,
        displayName: `Respondent ${i + 1}`,
        accountType: "MEMBER",
        ageBracket: pick(ages),
        genderBucket: pick(genders),
        metro: pick(metrosPool),
        points: Math.floor(rnd() * 4000),
      },
    });
    pool.push({ id: u.id, age: u.ageBracket!, gender: u.genderBucket!, metro: u.metro! });
  }

  console.log("Seeding the follow graph (creator audience)...");
  // maya + most neighbors follow rio; columbusjoe and desertdawn do not,
  // so the non-follower "extended audience" explanation branch is demoable.
  const rioFollowerHandles = [
    "maya",
    "danielk",
    "priya_reads",
    "windycityted",
    "angela_oakpark",
    "motorcitymara",
    "clevlandray",
  ];
  const followPairs: [string, string][] = rioFollowerHandles.map((h) =>
    h === "maya" ? [maya.id, rio.id] : [neighbors[h], rio.id]
  );
  // Half the synthetic pool follows rio too — the audience behind the numbers.
  for (let i = 0; i < pool.length; i += 2) {
    followPairs.push([pool[i].id, rio.id]);
  }
  await db.follow.createMany({
    data: followPairs.map(([followerId, followeeId]) => ({ followerId, followeeId })),
  });

  console.log("Seeding interests...");
  const mayaInterests: [string, number][] = [
    ["transit", 0.92],
    ["housing", 0.87],
    ["education", 0.71],
    ["elections", 0.64],
    ["economy", 0.48],
    ["energy-climate", 0.33],
  ];
  for (const [slug, affinity] of mayaInterests) {
    await db.userInterest.create({
      data: { userId: maya.id, topicId: topics[slug].id, affinity },
    });
  }
  const danielInterests: [string, number][] = [["transit", 0.8], ["economy", 0.7], ["housing", 0.5]];
  for (const [slug, affinity] of danielInterests) {
    await db.userInterest.create({
      data: { userId: neighbors["danielk"], topicId: topics[slug].id, affinity },
    });
  }

  console.log("Seeding happenings...");
  const happeningDefs = [
    {
      title: "Congressional appropriators face December deadline on transit funding",
      summary:
        "With the current extension expiring, House and Senate negotiators are split on formula vs. competitive grant share for mid-size metros. Local transit boards nationwide are watching the split closely.",
      sourceName: "Capitol Wire",
      metro: null,
      stateCode: null,
      topicSlug: "transit",
      hotness: 912,
      commentCount: 3,
      daysAgo: 0.3,
      comments: [
        { handle: "danielk", body: "Formula funding is the only way mid-size metros ever see a dollar of this. Competitive grants go to whoever can afford grant writers.", likes: 48 },
        { handle: "windycityted", body: "Every extension season the same fight. Just fund the buses.", likes: 31 },
      ],
    },
    {
      title: "CTA board weighs 24-hour service pilot on two Red Line branches",
      summary:
        "The pilot would target shift-worker zones on the South Side, running hourly trains between 1am and 4am for 18 months. Board members cite a ridership study; the budget fight is over station staffing.",
      sourceName: "Metro Desk",
      metro: "Chicago",
      stateCode: "IL",
      topicSlug: "transit",
      hotness: 1240,
      commentCount: 3,
      daysAgo: 0.8,
      comments: [
        { handle: "priya_reads", body: "I work nights at Northwestern. The 4am gap is the whole reason I Uber twice a week. This would pay for my transit in a month.", likes: 96 },
        { handle: "angela_oakpark", body: "Staffing is the real question — an empty platform at 3am helps nobody without attendants and working cameras.", likes: 57 },
        { handle: "maya", body: "If they pair this with the bus lane pilot it actually connects. Half measures are how transit plans die in this city.", likes: 73 },
      ],
    },
    {
      title: "Franklin County commissioners advance $190M housing bond to spring ballot",
      summary:
        "The bond would fund mixed-income construction and a first-time buyer down-payment program. Commissioners split 2-1 along party lines; the dissenting vote cited interest cost projections.",
      sourceName: "County Ledger",
      metro: "Columbus",
      stateCode: "OH",
      topicSlug: "housing",
      hotness: 645,
      commentCount: 2,
      daysAgo: 1.4,
      comments: [
        { handle: "columbusjoe", body: "Down-payment assistance is nice but the math on $190M in interest over 20 years deserves a real hearing first.", likes: 22 },
        { handle: "clevlandray", body: "Cuyahoga tried a smaller version of this. The construction actually happened — that's the part nobody believes until they see it.", likes: 40 },
      ],
    },
    {
      title: "Election researchers: down-ballot measures drew record engagement in 2026",
      summary:
        "Preliminary analyses suggest local ballot measures — transit levies, housing bonds, school referendums — drove turnout beyond gubernatorial races in several metros. Researchers caution full data is still being certified.",
      sourceName: "Capitol Wire",
      metro: null,
      stateCode: null,
      topicSlug: "elections",
      hotness: 1580,
      commentCount: 2,
      daysAgo: 2.1,
      comments: [
        { handle: "desertdawn", body: "People vote when the ballot item is something they can see from their porch. School board and sewers, that's real governance.", likes: 128 },
        { handle: "danielk", body: "This is the whole thesis of why local polling should be cheap. Interest is there — the measurement is priced out.", likes: 84 },
      ],
    },
    {
      title: "Statehouse committee hears school phone policy bill",
      summary:
        "The bill would require districts to adopt phone-restriction policies during instructional hours, leaving implementation to local boards. Testimony split between focus advocates and parent-reachability concerns.",
      sourceName: "Copper State Desk",
      metro: "Phoenix",
      stateCode: "AZ",
      topicSlug: "education",
      hotness: 830,
      commentCount: 2,
      daysAgo: 2.6,
      comments: [
        { handle: "motorcitymara", body: "Local boards deciding implementation is the right call. One-size policies from the statehouse never survive contact with a real classroom.", likes: 65 },
        { handle: "desertdawn", body: "As a retired teacher: the phone is not the problem, it's the symptom. But I'd have taken the restriction anyway.", likes: 142 },
      ],
    },
    {
      title: "City council votes on community benefits ordinance for stadium district",
      summary:
        "The ordinance would require developers receiving city land to fund workforce training and a community trust. Supporters call it a model; opponents warn it stalls projects in a construction-cost spike.",
      sourceName: "Motor City Desk",
      metro: "Detroit",
      stateCode: "MI",
      topicSlug: "economy",
      hotness: 720,
      commentCount: 2,
      daysAgo: 3.2,
      comments: [
        { handle: "motorcitymara", body: "We've heard 'it'll stall projects' since the riverfront. The riverfront got built. Working Detroitters got zip.", likes: 88 },
        { handle: "clevlandray", body: "Cleveland's version watered down the trust fund to pass. Watch the enforcement teeth, not the press release.", likes: 51 },
      ],
    },
    {
      title: "CPS budget hearing draws overflow crowd as deficit projections land",
      summary:
        "The district's five-year projection shows a structural gap driven by enrollment decline and expiring federal relief. Parents and principals packed the hearing to argue against central-office cuts.",
      sourceName: "Metro Desk",
      metro: "Chicago",
      stateCode: "IL",
      topicSlug: "education",
      hotness: 1105,
      commentCount: 2,
      daysAgo: 4.0,
      comments: [
        { handle: "angela_oakpark", body: "Every deficit cycle the same three words: central office cuts. And every cycle the classroom feels it first anyway.", likes: 203 },
        { handle: "priya_reads", body: "Enrollment decline is a housing story wearing a school costume. Families can't afford to stay in these zip codes.", likes: 157 },
        { handle: "maya", body: "The relief money papering over a structural gap was always going to end like this. The question is whether anyone planned for year five.", likes: 91 },
      ],
    },
    {
      title: "FCC opens comment period on broadband pricing transparency rules",
      summary:
        "The proposed rules would require all-in pricing disclosure and end promotional-rate ambiguity. Consumer groups back the measure; trade groups argue compliance costs fall on small regional providers.",
      sourceName: "Capitol Wire",
      metro: null,
      stateCode: null,
      topicSlug: "tech-privacy",
      hotness: 430,
      commentCount: 1,
      daysAgo: 5.3,
      comments: [
        { handle: "windycityted", body: "All-in pricing on the sticker. Radical concept. Grocery stores have managed it since forever.", likes: 76 },
      ],
    },
    {
      title: "Grid operators warn of summer capacity gaps as data center demand grows",
      summary:
        "Regional operators told regulators that large-load interconnections are outpacing generation additions in three regions. Ratepayer advocates want data centers on separate tariff schedules.",
      sourceName: "Capitol Wire",
      metro: null,
      stateCode: null,
      topicSlug: "energy-climate",
      hotness: 560,
      commentCount: 1,
      daysAgo: 6.1,
      comments: [
        { handle: "danielk", body: "Separate tariffs are obvious. Your utility bill shouldn't fund someone else's compute farm.", likes: 112 },
      ],
    },
  ];

  const happenings: Record<number, string> = {};
  for (let i = 0; i < happeningDefs.length; i++) {
    const h = happeningDefs[i];
    const created = await db.happening.create({
      data: {
        title: h.title,
        summary: h.summary,
        sourceName: h.sourceName,
        metro: h.metro,
        stateCode: h.stateCode,
        topicId: topics[h.topicSlug].id,
        hotness: h.hotness,
        commentCount: h.comments.length,
        createdAt: ago(h.daysAgo),
      },
    });
    happenings[i] = created.id;
    for (const c of h.comments) {
      const userId =
        c.handle === "maya" ? maya.id : neighbors[c.handle] ?? maya.id;
      await db.comment.create({
        data: {
          body: c.body,
          userId,
          happeningId: created.id,
          likes: c.likes,
          createdAt: ago(h.daysAgo - 0.05),
        },
      });
    }
  }

  console.log("Seeding sponsors and polls...");
  const sponsors = {
    meridian: await db.sponsor.create({
      data: { name: "Meridian Public Media", kind: "STATION", blurb: "Regional station group, 14 markets" },
    }),
    heartland: await db.sponsor.create({
      data: { name: "Heartland Civic Trust", kind: "NONPROFIT", blurb: "Nonpartisan civic engagement nonprofit" },
    }),
    science: await db.sponsor.create({
      data: { name: "Metro Science Alliance", kind: "RESEARCH", blurb: "Independent research collaborative" },
    }),
    coop: await db.sponsor.create({
      data: { name: "Main Street Co-op", kind: "BRAND", blurb: "Member-owned grocery cooperative" },
    }),
    capitol: await db.sponsor.create({
      data: { name: "Capitol Insight Group", kind: "ADVOCACY", blurb: "Cross-ideological policy research" },
    }),
    marlow: await db.sponsor.create({
      data: { name: "The Marlow Memo", kind: "CREATOR", blurb: "Rio Marlow's civic-explainer channel — 4.8k followers" },
    }),
  };

  async function makePoll(p: {
    sponsorId: string;
    question: string;
    context: string;
    topicSlug: string;
    samplingMode: string;
    creatorId?: string;
    targetMetros?: string[];
    rewardPoints: number;
    estimatedN: number;
    pricePerCompleteCents: number;
    status?: string;
    closesInDays: number;
    options: string[];
  }) {
    const poll = await db.poll.create({
      data: {
        sponsorId: p.sponsorId,
        question: p.question,
        context: p.context,
        topicId: topics[p.topicSlug].id,
        samplingMode: p.samplingMode,
        creatorId: p.creatorId ?? null,
        targetMetros: p.targetMetros ? JSON.stringify(p.targetMetros) : "NATIONAL",
        rewardPoints: p.rewardPoints,
        estimatedN: p.estimatedN,
        pricePerCompleteCents: p.pricePerCompleteCents,
        status: p.status ?? "LIVE",
        closesAt: new Date(now + p.closesInDays * DAYS),
      },
    });
    for (let i = 0; i < p.options.length; i++) {
      await db.pollOption.create({
        data: { pollId: poll.id, label: p.options[i], position: i },
      });
    }
    return poll;
  }

  // 1. QUOTA_UGC — the flagship methodology demo.
  const lateNight = await makePoll({
    sponsorId: sponsors.meridian.id,
    question: "Should your city fund 24-hour transit service in shift-worker zones?",
    context:
      "Meridian is running a multi-market series on overnight economies. Results air in our 'While You Were Asleep' segment and go to participating transit boards.",
    topicSlug: "transit",
    samplingMode: "QUOTA_UGC",
    rewardPoints: 75,
    estimatedN: 800,
    pricePerCompleteCents: 150,
    closesInDays: 5,
    options: ["Yes, fund it even if it means fare hikes", "Yes, but only with federal/state money", "No, overnight demand doesn't justify it", "Need to see the staffing plan first"],
  });

  // 2. UGC_MATCH — topical, fast, passionate.
  const housingPoll = await makePoll({
    sponsorId: sponsors.heartland.id,
    question: "What is the single biggest driver of housing cost where you live?",
    context:
      "The Trust is building a citizen-sourced cost map for our spring legislative briefing. You were matched because you engage with housing policy.",
    topicSlug: "housing",
    samplingMode: "UGC_MATCH",
    rewardPoints: 50,
    estimatedN: 1200,
    pricePerCompleteCents: 100,
    closesInDays: 8,
    options: ["Zoning and permitting delays", "Investor-owned rentals", "Construction labor costs", "Property taxes", "Interest rates", "Not enough of anything being built"],
  });

  // 3. RANDOM — defensibility demo.
  const workweekPoll = await makePoll({
    sponsorId: sponsors.science.id,
    question: "Should public employees get a four-day workweek pilot in your state?",
    context:
      "MSA is testing a pure random draw for this one — no targeting at all — so the result can serve as a methodological benchmark against our engaged samples.",
    topicSlug: "economy",
    samplingMode: "RANDOM",
    rewardPoints: 60,
    estimatedN: 1500,
    pricePerCompleteCents: 120,
    closesInDays: 10,
    options: ["Strongly support a pilot", "Support with productivity safeguards", "Oppose — services would suffer", "Oppose — unfair to private sector"],
  });

  // 4. SPONSOR_SEGMENT — the Kroger-style zip-code buy.
  const groceryPoll = await makePoll({
    sponsorId: sponsors.coop.id,
    question: "What is your household's biggest grocery budget pain point right now?",
    context:
      "The Co-op is deciding 2027 store locations and own-brand pricing across our Ohio markets. Your segment: three Ohio metros, all ages.",
    topicSlug: "economy",
    samplingMode: "SPONSOR_SEGMENT",
    targetMetros: ["Columbus", "Cleveland", "Cincinnati"],
    rewardPoints: 40,
    estimatedN: 900,
    pricePerCompleteCents: 225,
    closesInDays: 6,
    options: ["Meat and protein prices", "Produce quality per dollar", "Everything — the whole basket", "Store brand selection", "Fuel to get to the store"],
  });

  // 5. QUOTA_UGC, CLOSED, fully seeded — the publishable-results demo.
  const priorityPoll = await makePoll({
    sponsorId: sponsors.capitol.id,
    question: "Post-midterm: which issue should state lawmakers tackle first in 2027?",
    context:
      "Fielded in the two weeks after the election. Weighted to census targets. Full methodology published with the release.",
    topicSlug: "elections",
    samplingMode: "QUOTA_UGC",
    rewardPoints: 75,
    estimatedN: 500,
    pricePerCompleteCents: 150,
    status: "CLOSED",
    closesInDays: -1,
    options: ["Housing affordability", "Property and income taxes", "Public safety", "School funding", "Healthcare costs", "Infrastructure and transit"],
  });

  // 6. LIKERT — trust index.
  const trustPoll = await makePoll({
    sponsorId: sponsors.heartland.id,
    question: "How much do you trust local government to spend tax dollars wisely?",
    context: "Quarterly Civic Trust Index. Trended across four quarters now.",
    topicSlug: "elections",
    samplingMode: "QUOTA_UGC",
    rewardPoints: 55,
    estimatedN: 1000,
    pricePerCompleteCents: 150,
    closesInDays: 12,
    options: ["1 — No trust at all", "2", "3 — Neutral", "4", "5 — Complete trust"],
  });

  // 7. CREATOR — the poll runs through a creator channel to its followers.
  // Station × creator collab: Meridian buys Rio Marlow's audience; Rio
  // takes rev share on every complete. Followers see it first-hand.
  const creatorPoll = await makePoll({
    sponsorId: sponsors.meridian.id,
    question: "Should the city fast-track community land trusts to develop its vacant lots?",
    context:
      "From tonight's Marlow Memo with Meridian: the lot-by-lot map of city-owned vacancies, and what happened where land trusts got there first. Results read on air.",
    topicSlug: "housing",
    samplingMode: "CREATOR",
    creatorId: rio.id,
    targetMetros: ["Chicago"],
    rewardPoints: 65,
    estimatedN: 600,
    pricePerCompleteCents: 300,
    closesInDays: 7,
    options: ["Yes — land trusts get first claim", "Only with a mixed-income requirement", "No — sell to the highest bidder", "Case-by-case, too early to commit"],
  });

  console.log("Seeding poll responses...");
  async function seedResponses(
    pollId: string,
    optionIds: string[],
    weights: number[], // probability weights per option
  ) {
    const totalW = weights.reduce((a, b) => a + b, 0);
    for (const u of pool) {
      let r = rnd() * totalW;
      let idx = 0;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) { idx = i; break; }
      }
      await db.pollResponse.create({
        data: {
          pollId,
          optionId: optionIds[idx],
          userId: u.id,
          quotaCell: `${u.age}|${u.gender}|${u.metro}`,
          weight: 1,
          rewardAwarded: 0,
        },
      });
    }
  }

  const closedOptions = await db.pollOption.findMany({
    where: { pollId: priorityPoll.id },
    orderBy: { position: "asc" },
  });
  await seedResponses(
    priorityPoll.id,
    closedOptions.map((o) => o.id),
    [3.1, 2.4, 1.6, 2.0, 1.4, 1.9],
  );

  const lateNightOptions = await db.pollOption.findMany({
    where: { pollId: lateNight.id },
    orderBy: { position: "asc" },
  });
  await seedResponses(
    lateNight.id,
    lateNightOptions.map((o) => o.id),
    [2.2, 3.0, 1.2, 1.8],
  );

  const trustOptions = await db.pollOption.findMany({
    where: { pollId: trustPoll.id },
    orderBy: { position: "asc" },
  });
  await seedResponses(
    trustPoll.id,
    trustOptions.map((o) => o.id),
    [1.4, 1.9, 2.6, 2.0, 1.1],
  );

  const workweekOptions = await db.pollOption.findMany({
    where: { pollId: workweekPoll.id },
    orderBy: { position: "asc" },
  });
  await seedResponses(
    workweekPoll.id,
    workweekOptions.map((o) => o.id),
    [2.5, 2.9, 1.5, 1.1],
  );

  const creatorOptions = await db.pollOption.findMany({
    where: { pollId: creatorPoll.id },
    orderBy: { position: "asc" },
  });
  await seedResponses(
    creatorPoll.id,
    creatorOptions.map((o) => o.id),
    [2.8, 2.4, 1.1, 1.9],
  );

  console.log("Seeding wallet history...");
  const txDefs = [
    { kind: "POINTS", amount: 94, memo: "Completed: Post-midterm priorities (Capitol Insight Group)", daysAgo: 2 },
    { kind: "REV_SHARE", amount: 12, memo: "1% responder share — Civic Trust Index Q3", daysAgo: 3 },
    { kind: "SWEEPSTAKES", amount: 2, memo: "2× entries — Chicago October drawing", daysAgo: 3 },
    { kind: "POINTS", amount: 63, memo: "Completed: CTA overnight service attitudes (Meridian)", daysAgo: 5 },
    { kind: "PERK", amount: 1, memo: "Early results access unlocked — Weathered tier", daysAgo: 8 },
    { kind: "POINTS", amount: 88, memo: "Completed: Housing cost driver map (Heartland Civic Trust)", daysAgo: 9 },
    { kind: "SWEEPSTAKES", amount: 2, memo: "2× entries — Chicago September drawing", daysAgo: 12 },
    { kind: "POINTS", amount: 50, memo: "Signup bonus — welcome to the flock", daysAgo: 30 },
  ];
  for (const t of txDefs) {
    await db.rewardTransaction.create({
      data: {
        userId: maya.id,
        kind: t.kind,
        amount: t.amount,
        memo: t.memo,
        createdAt: ago(t.daysAgo),
      },
    });
  }

  const counts = {
    users: await db.user.count(),
    follows: await db.follow.count(),
    happenings: await db.happening.count(),
    comments: await db.comment.count(),
    sponsors: await db.sponsor.count(),
    polls: await db.poll.count(),
    responses: await db.pollResponse.count(),
    transactions: await db.rewardTransaction.count(),
  };
  console.log("Seed complete:", JSON.stringify(counts, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
