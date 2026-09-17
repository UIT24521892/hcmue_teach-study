import { dateKey, shiftDate } from "../../lib/dates";
import type { DemoData } from "./schema";

export function createDemoData(): DemoData {
  return {
    version: 1,
    role: "teacher",
    name: "Minh Anh",
    goal: 5,
    notes: Array.from({ length: 12 }, (_, index) => ({
      id: `seed-note-${index}`,
      date: dateKey(shiftDate(new Date(), index - 11)),
      content:
        index === 11
          ? "Hôm nay mình ôn cách dùng present perfect và ghi nhớ thêm 5 cụm từ về thói quen.\n\nA little progress every day adds up to big results."
          : "Ôn từ vựng và luyện đọc một đoạn tiếng Anh ngắn. Đặt câu với các từ mới để nhớ lâu hơn.",
      tags: index % 2 ? "Grammar, Daily English" : "Vocabulary",
      understanding: 2,
    })),
    documents: [
      {
        id: "doc-1",
        title: "Small habits, big changes",
        type: "PDF",
        status: "ready",
        size: "1.2 MB",
      },
      {
        id: "doc-2",
        title: "Present perfect · Unit 4",
        type: "DOCX",
        status: "review",
        size: "480 KB",
      },
      { id: "doc-3", title: "Everyday vocabulary", type: "TXT", status: "ready", size: "12 KB" },
    ],
    classes: [
      {
        id: "class-1",
        name: "Tiếng Anh 10A2",
        description: "Cùng xây nền tảng, từng bài học nhỏ.",
        members: 32,
        code: "MACH10A",
      },
      {
        id: "class-2",
        name: "IELTS Foundation",
        description: "Đọc hiểu & từ vựng · Mục tiêu 6.0",
        members: 24,
        code: "IELTS60",
      },
    ],
    attempts: [],
  };
}

export interface Question {
  id: string;
  type: "choice" | "boolean" | "fill";
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
}
export interface Quiz {
  id: string;
  title: string;
  category: string;
  level: string;
  minutes: number;
  description: string;
  questions: Question[];
}
export const quizzes: Quiz[] = [
  {
    id: "small-habits",
    title: "Small habits, big changes",
    category: "Reading",
    level: "A2–B1",
    minutes: 10,
    description:
      "Khởi đầu nhỏ, tiến bộ lớn. Luyện đọc và khám phá sức mạnh của những thói quen hàng ngày.",
    questions: [
      {
        id: "q1",
        type: "choice",
        prompt: "Choose the correct sentence.",
        options: [
          "She study English every day.",
          "She studies English every day.",
          "She studying English every day.",
        ],
        answer: "She studies English every day.",
        explanation:
          "Ở hiện tại đơn, chủ ngữ she/he/it đi với động từ thêm -s hoặc -es. Study đổi thành studies.",
      },
      {
        id: "q2",
        type: "boolean",
        prompt:
          "“A little progress every day adds up to big results” encourages consistent practice.",
        options: ["True", "False"],
        answer: "True",
        explanation:
          "Câu nói nhấn mạnh việc luyện tập đều đặn: những tiến bộ nhỏ mỗi ngày sẽ tích lũy thành kết quả lớn.",
      },
      {
        id: "q3",
        type: "fill",
        prompt: "Complete: I have ___ English for two years. (study)",
        options: [],
        answer: "studied",
        explanation:
          "Hiện tại hoàn thành có dạng have/has + past participle. Quá khứ phân từ của study là studied.",
      },
      {
        id: "q4",
        type: "choice",
        prompt: "Which word is closest in meaning to “consistent”?",
        options: ["Regular", "Rare", "Sudden"],
        answer: "Regular",
        explanation: "Consistent có nghĩa là đều đặn, nhất quán; gần nghĩa nhất với regular.",
      },
      {
        id: "q5",
        type: "choice",
        prompt: "Choose the best habit for remembering new words.",
        options: [
          "Never use them again",
          "Review and use them in sentences",
          "Read the list only once",
        ],
        answer: "Review and use them in sentences",
        explanation:
          "Ôn lại và sử dụng từ trong ngữ cảnh giúp bạn nhớ và vận dụng từ vựng tốt hơn.",
      },
    ],
  },
  {
    id: "everyday-english",
    title: "A day in your life",
    category: "Vocabulary",
    level: "A1–A2",
    minutes: 5,
    description: "Những từ quen thuộc giúp bạn kể lại một ngày của mình bằng tiếng Anh.",
    questions: [
      {
        id: "v1",
        type: "choice",
        prompt: "I usually ___ breakfast at 7 a.m.",
        options: ["have", "do", "make up"],
        answer: "have",
        explanation: "Have breakfast là cụm từ diễn tả việc ăn sáng.",
      },
      {
        id: "v2",
        type: "fill",
        prompt: "Complete: She goes to school ___ bus.",
        options: [],
        answer: "by",
        explanation: "Dùng by trước phương tiện: by bus, by train, by bike.",
      },
      {
        id: "v3",
        type: "boolean",
        prompt: "“Wake up” means to stop sleeping.",
        options: ["True", "False"],
        answer: "True",
        explanation: "Wake up nghĩa là thức dậy, chấm dứt trạng thái ngủ.",
      },
    ],
  },
];

export function scoreQuiz(quiz: Quiz, answers: Record<string, string>): number {
  return Math.round(
    (quiz.questions.filter(
      (q) => answers[q.id]?.trim().toLocaleLowerCase() === q.answer.toLocaleLowerCase(),
    ).length /
      quiz.questions.length) *
      100,
  );
}
