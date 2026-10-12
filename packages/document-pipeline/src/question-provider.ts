import { z } from "zod";

import { DocumentPipelineError } from "./errors.js";
import type {
  GeneratedQuestion,
  QuestionGenerationInput,
  QuestionGenerationProvider,
} from "./types.js";

export const generatedQuestionSchema = z
  .object({
    type: z.enum(["multiple_choice", "fill_blank", "true_false"]),
    prompt: z.string().trim().min(1).max(2_000),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(6).nullable(),
    correctAnswer: z.string().trim().min(1).max(1_000),
    explanation: z.string().trim().min(1).max(4_000),
    difficulty: z.enum(["easy", "medium", "hard"]),
  })
  .superRefine((question, context) => {
    if (question.type === "multiple_choice") {
      if (!question.options || !question.options.includes(question.correctAnswer)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["correctAnswer"],
          message: "Đáp án trắc nghiệm phải thuộc danh sách lựa chọn.",
        });
      }
      return;
    }

    if (question.options !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Câu điền từ và đúng/sai không dùng danh sách lựa chọn.",
      });
    }

    if (question.type === "true_false" && !["true", "false"].includes(question.correctAnswer)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctAnswer"],
        message: 'Đáp án đúng/sai phải là "true" hoặc "false".',
      });
    }
  });

export const generatedQuestionSetSchema = z
  .array(generatedQuestionSchema)
  .min(1)
  .max(20)
  .superRefine((questions, context) => {
    const prompts = new Set<string>();
    for (const [index, question] of questions.entries()) {
      const normalized = question.prompt.toLocaleLowerCase();
      if (prompts.has(normalized)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "prompt"],
          message: "Bộ câu hỏi không được có nội dung trùng nhau.",
        });
      }
      prompts.add(normalized);
    }
  });

function wordsFrom(text: string): string[] {
  return text
    .replace(/[^\p{L}\p{N}'-]+/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3);
}

function distinctWords(words: string[]): string[] {
  const seen = new Set<string>();
  return words.filter((word) => {
    const key = word.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Deterministic local provider used in development and tests; it never calls an external API. */
export class MockQuestionGenerationProvider implements QuestionGenerationProvider {
  readonly name = "mock";

  async generate(input: QuestionGenerationInput): Promise<GeneratedQuestion[]> {
    const words = distinctWords(wordsFrom(input.sourceText));
    const answer = words[0] ?? "learning";
    const distractors = [...words.slice(1, 4), "practice", "context", "review"]
      .filter((word) => word.toLocaleLowerCase() !== answer.toLocaleLowerCase())
      .slice(0, 3);
    const firstSentence =
      input.sourceText
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .find(Boolean) ?? input.sourceText.slice(0, 240).trim();

    return [
      {
        type: "multiple_choice",
        prompt: "Từ nào xuất hiện trong tài liệu?",
        options: [answer, ...distractors],
        correctAnswer: answer,
        explanation: `“${answer}” xuất hiện trực tiếp trong nội dung nguồn.`,
        difficulty: "easy",
      },
      {
        type: "fill_blank",
        prompt: `Điền từ còn thiếu: ${firstSentence.replace(new RegExp(answer, "iu"), "____")}`,
        options: null,
        correctAnswer: answer,
        explanation: `Từ cần điền là “${answer}”, dựa trên câu đầu của tài liệu.`,
        difficulty: "medium",
      },
      {
        type: "true_false",
        prompt: `Đúng hay sai: tài liệu có nhắc đến “${answer}”.`,
        options: null,
        correctAnswer: "true",
        explanation: `Nội dung nguồn có chứa từ “${answer}”.`,
        difficulty: "easy",
      },
    ].slice(0, Math.max(1, Math.min(input.targetQuestionCount, 3))) as GeneratedQuestion[];
  }
}

export async function generateValidatedQuestions(
  provider: QuestionGenerationProvider,
  input: QuestionGenerationInput,
): Promise<GeneratedQuestion[]> {
  let output: unknown;
  try {
    output = await provider.generate(input);
  } catch (error) {
    throw new DocumentPipelineError(
      "PROVIDER_FAILED",
      "Dịch vụ sinh câu hỏi tạm thời không khả dụng.",
      { retryable: true, cause: error },
    );
  }

  const parsed = generatedQuestionSetSchema.safeParse(output);
  if (!parsed.success) {
    throw new DocumentPipelineError(
      "PROVIDER_INVALID_OUTPUT",
      "Dịch vụ AI trả về bộ câu hỏi không hợp lệ.",
      { retryable: true, cause: parsed.error },
    );
  }

  return parsed.data;
}
