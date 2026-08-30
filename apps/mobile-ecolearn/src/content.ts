export type LessonEditorial = {
  intro: string;
  facts: Array<{ title: string; body: string }>;
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
};

export const lessonEditorial: Record<string, LessonEditorial> = {
  "10000000-0000-4000-8000-000000000001": {
    intro: "Recycling is a system, not a wish. Careful sorting helps useful materials become new products instead of waste.",
    facts: [
      { title: "Start clean", body: "Food and liquid can contaminate recyclable material. Empty containers and give them a quick rinse." },
      { title: "Keep it loose", body: "Loose items can be sorted by equipment. Plastic bags wrap around machinery and belong at a dedicated drop-off." },
      { title: "Check the exact item", body: "The recycling symbol does not guarantee curbside acceptance. Use Delaware DNREC guidance for the item in your hand." },
    ],
    question: "Which action best helps a recycling facility sort materials?",
    choices: ["Put recyclables in a plastic bag", "Keep empty items loose in the bin", "Recycle every item with a triangle"],
    answer: 1,
    explanation: "Correct. Loose, clean, empty items are much easier for a facility to sort.",
  },
  "10000000-0000-4000-8000-000000000002": {
    intro: "Plastic numbers identify resin types, but the number alone does not promise that an item belongs in your curbside bin.",
    facts: [
      { title: "Shape matters", body: "Bottles, jars, and tubs are commonly accepted because sorting facilities and markets are prepared for them." },
      { title: "Film is different", body: "Bags, wrappers, and film can tangle sorting equipment and usually need a dedicated store drop-off." },
      { title: "Labels are clues", body: "Use the material, shape, and official local guidance together instead of relying on one symbol." },
    ],
    question: "What is the safest choice for plastic bags and film?",
    choices: ["Place them loose in curbside recycling", "Use a dedicated store drop-off if available", "Put them in with paper"],
    answer: 1,
    explanation: "Exactly. Film plastic tangles sorting equipment; use a dedicated collection program.",
  },
  "10000000-0000-4000-8000-000000000003": {
    intro: "Wishcycling happens when good intentions put the wrong item in recycling. It raises costs and can spoil recoverable material.",
    facts: [
      { title: "No mystery items", body: "If you cannot identify the material or find it in the official catalog, keep it out of curbside recycling until you verify it." },
      { title: "Grease changes paper", body: "Food-soiled cardboard and paper fibers cannot be recycled into clean paper products." },
      { title: "Special waste is different", body: "Batteries, electronics, and chemicals can be hazardous and need a dedicated collection program." },
    ],
    question: "Why should a greasy pizza box stay out of paper recycling?",
    choices: ["It is too heavy", "Grease contaminates the paper fibers", "Cardboard is never recyclable"],
    answer: 1,
    explanation: "Right. Clean cardboard is valuable; grease makes its fibers unsuitable for recycling.",
  },
  "10000000-0000-4000-8000-000000000004": {
    intro: "Food scraps are a resource. Composting returns nutrients to soil and helps keep methane-producing organic waste out of landfill.",
    facts: [
      { title: "Choose the right scraps", body: "Fruit and vegetable scraps, coffee grounds, and yard trimmings are useful starting materials." },
      { title: "Balance matters", body: "Healthy compost combines moist green material with dry brown material such as leaves or shredded paper." },
      { title: "Keep contaminants out", body: "Plastic stickers, wrappers, and packaging do not belong unless your local program explicitly accepts them." },
    ],
    question: "Which is a useful brown material for a compost pile?",
    choices: ["Dry leaves", "A plastic wrapper", "A battery"],
    answer: 0,
    explanation: "Yes. Dry leaves add carbon-rich brown material and balance moist food scraps.",
  },
  "10000000-0000-4000-8000-000000000005": {
    intro: "Glass and metal are durable materials, but they still need the right preparation before they enter Delaware's recycling system.",
    facts: [
      { title: "Empty and rinse", body: "Leftover food or drink can contaminate clean material, so empty and quickly rinse containers." },
      { title: "Separate hazardous items", body: "Broken glass, sharp metal, and pressurized containers may need special handling." },
      { title: "Do not flatten everything", body: "Sorting equipment recognizes three-dimensional containers more reliably than crushed or flattened items." },
    ],
    question: "What should you do before recycling a food jar or soda can?",
    choices: ["Leave food residue inside", "Empty and rinse it", "Wrap it in a bag"],
    answer: 1,
    explanation: "Correct. Empty, clean containers give the recycling system the best chance of success.",
  },
  "10000000-0000-4000-8000-000000000006": {
    intro: "Composting works best when you understand what belongs in the pile and what should stay out.",
    facts: [
      { title: "Green and brown", body: "Food scraps are green material, while dry leaves and paper are brown material that add structure and carbon." },
      { title: "Air and moisture", body: "A healthy pile should be damp, not soaked, and turned occasionally so decomposers have oxygen." },
      { title: "Local rules win", body: "Commercial composting programs may accept different items than a backyard pile. Confirm the program before sorting." },
    ],
    question: "Which item is usually safe to add to a compost bin?",
    choices: ["Dry leaves", "A battery", "Plastic cutlery"],
    answer: 0,
    explanation: "Right. Dry leaves are a classic compost ingredient and help balance food scraps.",
  },
};

export const challengeDefinitions = [
  {
    key: "daily_three_scans",
    title: "First three smart scans",
    description: "Verify three items against the official Delaware catalog.",
    metric: "scans" as const,
    target: 3,
    xp: 15,
    claimable: true,
  },
  {
    key: "first_lesson",
    title: "Finish a lesson",
    description: "Complete a lesson and prove what you learned in the quiz.",
    metric: "lessons" as const,
    target: 1,
    xp: 20,
    claimable: false,
  },
  {
    key: "seven_day_streak",
    title: "Build a seven-day habit",
    description: "Return and complete a verified activity on seven consecutive days.",
    metric: "streak" as const,
    target: 7,
    xp: 0,
    claimable: false,
  },
];

export const dswaVideoForItem = (values: Array<string | null | undefined>) => {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (/electronic|computer|laptop|tablet|phone|television|printer|device|appliance|charger|e-waste/.test(text)) {
    return { title: "DSWA: Electronics recycling", url: "https://www.youtube.com/watch?v=zgM9MRqwlEc" };
  }
  if (/hazardous|battery|batteries|paint|chemical|propane|special collection/.test(text)) {
    return { title: "DSWA: Special collection events", url: "https://www.youtube.com/watch?v=_FXnpUKHgHI" };
  }
  if (/curbside|recycl|aluminum|glass|metal|plastic|paper|carton/.test(text)) {
    return { title: "DSWA: Delaware Recycling Center tour", url: "https://www.youtube.com/watch?v=mzh2A_s5GUQ" };
  }
  return null;
};
