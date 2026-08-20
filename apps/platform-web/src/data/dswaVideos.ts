export type DswaVideo = {
  id: string;
  title: string;
  description: string;
  topics: string[];
  lessonIds: string[];
};

export const DSWA_VIDEO_PAGE = "https://dswaeducation.com/videos/";

export const dswaVideos: DswaVideo[] = [
  {
    id: "vOPT_3H_MUE",
    title: "DSWA Overview",
    description: "Meet the Delaware Solid Waste Authority and see how its programs support Delaware communities.",
    topics: ["dswa", "overview", "delaware", "waste system"],
    lessonIds: ["10000000-0000-4000-8000-000000000001"],
  },
  {
    id: "mzh2A_s5GUQ",
    title: "DSWA Delaware Recycling Center Tour",
    description: "Follow accepted recyclables through Delaware's sorting process and see why clean, loose items matter.",
    topics: ["recycle", "recycling", "curbside", "can", "bottle", "glass", "metal", "paper", "plastic", "carton"],
    lessonIds: [
      "10000000-0000-4000-8000-000000000001",
      "10000000-0000-4000-8000-000000000002",
      "10000000-0000-4000-8000-000000000003",
      "10000000-0000-4000-8000-000000000005",
    ],
  },
  {
    id: "zgM9MRqwlEc",
    title: "DSWA Electronics Recycling",
    description: "Learn why electronics need special handling and how DSWA keeps them out of curbside recycling.",
    topics: [
      "electronic", "electronics", "computer", "laptop", "tablet", "phone", "television", "tv",
      "camera", "printer", "device", "appliance", "charger", "cord", "video game", "e-waste",
    ],
    lessonIds: ["10000000-0000-4000-8000-000000000003"],
  },
  {
    id: "_FXnpUKHgHI",
    title: "DSWA Special Collection Events",
    description: "See how Delaware residents can safely handle electronics, household hazardous waste, and other special items.",
    topics: [
      "special collection", "hazardous", "battery", "batteries", "paint", "chemical", "oil", "propane",
      "fluorescent", "electronics", "shred", "document",
    ],
    lessonIds: ["10000000-0000-4000-8000-000000000003"],
  },
  {
    id: "ysy8akz_ZHg",
    title: "DSWA Transfer Station Tour",
    description: "Learn how waste moves safely from local collection vehicles into Delaware's larger waste system.",
    topics: ["transfer station", "trash", "garbage", "waste", "transport"],
    lessonIds: ["10000000-0000-4000-8000-000000000001"],
  },
  {
    id: "efhJZhkR0HA",
    title: "DSWA Delaware Landfill Tour",
    description: "Explore how a modern Delaware landfill manages waste and protects the surrounding environment.",
    topics: ["landfill", "trash", "garbage", "waste", "compost", "food scraps"],
    lessonIds: [
      "10000000-0000-4000-8000-000000000003",
      "10000000-0000-4000-8000-000000000004",
      "10000000-0000-4000-8000-000000000006",
    ],
  },
  {
    id: "_Z6YeG5LcB4",
    title: "Dover Environmental Education Center",
    description: "Discover DSWA's Dover education center and its hands-on environmental learning opportunities.",
    topics: ["education", "field trip", "classroom", "dover", "environment"],
    lessonIds: [],
  },
];

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function videosForLesson(lessonId: string) {
  return dswaVideos.filter((video) => video.lessonIds.includes(lessonId));
}

export function videosForScan(values: Array<string | null | undefined>) {
  const haystack = normalize(values.filter(Boolean).join(" "));
  if (!haystack) return [];

  const ranked = dswaVideos
    .map((video) => ({
      video,
      score: video.topics.reduce((total, topic) => total + (haystack.includes(normalize(topic)) ? 1 : 0), 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score);

  return ranked.slice(0, 2).map(({ video }) => video);
}
