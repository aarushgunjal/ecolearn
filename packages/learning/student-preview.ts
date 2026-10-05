export type StudentPreviewData = {
  name: string;
  school: string;
  grade: string;
  assignments: {
    id: string;
    title: string;
    lesson_id: string;
    lesson_title: string;
    due_at: string | null;
  }[];
  announcements: { id: string; title: string; body: string }[];
  events: {
    id: string;
    title: string;
    description: string;
    starts_at: string;
    location: string;
  }[];
};
