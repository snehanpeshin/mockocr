export type Guide = {
  slug: string;
  title: string;
  description: string;
  audience: string;
  readTime: string;
  sections: {
    heading: string;
    body: string[];
  }[];
};

export const guides: Guide[] = [
  {
    slug: "convert-handwritten-notes-to-text",
    title: "How to Convert Handwritten Notes to Editable Text",
    description:
      "A practical guide to scanning handwritten notes, improving image quality, reviewing OCR output, and turning paper into useful digital text.",
    audience: "Students and families",
    readTime: "7 min read",
    sections: [
      {
        heading: "Start with a readable page",
        body: [
          "The best handwriting OCR result starts before software touches the image. Put the page on a flat surface, use bright even light, and avoid shadows from your phone or hand. A slightly slower capture often saves several minutes of editing later.",
          "If the paper is curled, hold the corners down outside the written area. If the ink is faint, place the page on a darker background so the camera can find the edge of the sheet more easily."
        ]
      },
      {
        heading: "Capture the whole page, not just the middle",
        body: [
          "Many missed words come from cropping too tightly. Leave a small border around the page so headings, page numbers, marginal notes, and bottom lines are included.",
          "For long notes, scan one page at a time. Multi-page documents work best when every page is clear enough to stand on its own."
        ]
      },
      {
        heading: "Review the OCR draft like a first pass",
        body: [
          "Handwriting OCR should be treated as a draft, not a final answer. Letters such as b and 6, O and 0, or l and 1 can look similar in a rushed notebook. Always compare important text with the original image.",
          "Karigari is designed around this review step: capture the page, receive editable text, then correct anything uncertain before saving or exporting."
        ]
      },
      {
        heading: "Export only after cleanup",
        body: [
          "TXT is useful for simple notes. DOCX is better when you want to continue editing in a word processor. PDF is helpful when you want a shareable copy after the text has been checked.",
          "For schoolwork, keep the original image until you are confident the digital text matches what was written."
        ]
      }
    ]
  },
  {
    slug: "scan-homework-worksheets",
    title: "Best Practices for Scanning Homework and Worksheets",
    description:
      "How parents, tutors, and students can scan worksheets, handwritten answers, annotations, and practice pages with fewer OCR mistakes.",
    audience: "Parents and tutors",
    readTime: "6 min read",
    sections: [
      {
        heading: "Use a repeatable scan routine",
        body: [
          "A simple routine helps children and parents get consistent results: place the page flat, align the phone parallel to the paper, check the light, then capture. Repeating the same setup matters more than using an expensive device.",
          "For younger students, a reusable writing tablet or clipboard can help keep the page still while the adult captures the work."
        ]
      },
      {
        heading: "Separate printed text from handwritten answers",
        body: [
          "Worksheets often contain printed instructions plus handwritten responses. Printed text is usually easier for OCR than pencil or marker. Handwritten answers may need more review, especially when letters are large, tilted, or written over ruled lines.",
          "If the handwritten answer is the important part, make sure it is in focus even if the printed worksheet text is already obvious."
        ]
      },
      {
        heading: "Watch for math and diagrams",
        body: [
          "Equations, arrows, circles, underlines, and drawings carry meaning. OCR systems can miss them or simplify them. When scanning homework, check whether the text output preserves the parts that explain the student's thinking.",
          "If a diagram is important, save the image as a reference even after converting the words around it."
        ]
      },
      {
        heading: "Build a learning record",
        body: [
          "A scanned worksheet is more useful when it becomes part of a searchable record. Parents can keep spelling practice, math work, tutoring notes, and revision pages organized by date or subject.",
          "This record can help families notice patterns, such as which topics need practice or which types of handwriting cause the most transcription errors."
        ]
      }
    ]
  },
  {
    slug: "how-handwriting-ocr-works",
    title: "How Handwriting OCR Works",
    description:
      "A plain-English explanation of handwriting OCR, image preprocessing, text detection, recognition, and why review is still necessary.",
    audience: "Curious learners",
    readTime: "8 min read",
    sections: [
      {
        heading: "OCR has two big jobs",
        body: [
          "First, the system has to find text in the image. This is called text detection. It decides where words, lines, or blocks are located on the page.",
          "Second, it has to recognize what those marks say. This is called text recognition. Handwriting makes this harder because every person forms letters differently."
        ]
      },
      {
        heading: "Image quality changes everything",
        body: [
          "Before recognition, many OCR tools try to improve the image. They may crop the page, adjust contrast, reduce shadows, deskew a tilted scan, or sharpen faint writing.",
          "These steps are not cosmetic. A dark photo can hide pencil marks, and a tilted page can make line detection less reliable."
        ]
      },
      {
        heading: "Why handwriting is harder than print",
        body: [
          "Printed fonts are consistent. Handwritten letters vary by writer, speed, pen type, paper, and fatigue. The same student may write a letter one way at the top of the page and a different way at the bottom.",
          "That is why reviewable OCR is important. A good app should help users check the draft, not pretend that every character is certain."
        ]
      },
      {
        heading: "Where AI can help",
        body: [
          "AI can help by checking whether words and lines make sense in context. It can notice repeated patterns, likely subject terms, and grammar issues.",
          "However, AI must not invent content. For educational notes, the safest workflow is transcription first, correction second, and summarization only after the original has been preserved."
        ]
      }
    ]
  },
  {
    slug: "why-handwriting-ocr-makes-mistakes",
    title: "Why Handwriting OCR Makes Mistakes",
    description:
      "Common reasons handwriting OCR misreads letters, equations, diagrams, and low-light photos, plus ways to reduce those errors.",
    audience: "Students and teachers",
    readTime: "7 min read",
    sections: [
      {
        heading: "Some characters look alike",
        body: [
          "A handwritten b can look like 6. A lowercase l can look like 1. A zero can look like the letter O. OCR systems choose what seems most likely, but the first choice is not always correct.",
          "Context helps, but context must be used carefully. The system should correct obvious character mistakes without replacing a student's actual work with a formula or sentence that was never written."
        ]
      },
      {
        heading: "Lines can be missed",
        body: [
          "Long notes often fail when the system treats the page as a single block. Small side notes, low-contrast pencil marks, and crowded lines may be skipped.",
          "A better capture process looks for all written regions and encourages users to rescan if the page is too dark, too blurry, or too tilted."
        ]
      },
      {
        heading: "Equations need special care",
        body: [
          "Math notes are not ordinary paragraphs. Superscripts, fractions, parentheses, and operators can be small but essential. OCR may read a symbol as a number or drop it entirely.",
          "For study use, users should compare every important equation with the image before relying on the converted text."
        ]
      },
      {
        heading: "The goal is better review, not magic",
        body: [
          "The most honest handwriting OCR workflow shows a draft and gives users a place to edit it. This is especially important for homework, research notes, and professional records.",
          "Karigari focuses on making the draft useful, editable, and searchable while reminding users to verify important material."
        ]
      }
    ]
  },
  {
    slug: "organize-digital-study-notes",
    title: "How Students Can Organize Digital Study Notes",
    description:
      "A simple system for turning scanned handwritten pages into searchable study records organized by subject, date, and review purpose.",
    audience: "Students",
    readTime: "6 min read",
    sections: [
      {
        heading: "Name notes the same way every time",
        body: [
          "A useful naming pattern might be subject, topic, and date: Biology cell notes 2026-08-06. Consistent names make search easier even before any advanced tagging system exists.",
          "Students should avoid vague names like page one or homework. The title should help future-you understand why the note matters."
        ]
      },
      {
        heading: "Save by subject and purpose",
        body: [
          "Some pages are lecture notes. Others are homework corrections, formula sheets, tutoring notes, or exam review. Saving this purpose alongside the text makes later review faster.",
          "A small amount of organization at capture time prevents a large pile of anonymous scans later."
        ]
      },
      {
        heading: "Keep the original image",
        body: [
          "Editable text is convenient, but the original page remains the source of truth. This is important when OCR is uncertain or when diagrams and formatting carry meaning.",
          "For high-stakes studying, compare the converted note with the image before deleting or sharing anything."
        ]
      },
      {
        heading: "Turn notes into review material",
        body: [
          "Once a note has been checked, it can become a flashcard source, summary, checklist, or study guide. This works best when the transcription is faithful to the original.",
          "The best system is simple: write naturally, scan clearly, correct the draft, then organize it for search."
        ]
      }
    ]
  },
  {
    slug: "scanning-math-notes",
    title: "Scanning Math Notes: What Works and What Fails",
    description:
      "A realistic guide to scanning algebra, formulas, symbols, and diagrams without losing the meaning of the original handwritten page.",
    audience: "Math students",
    readTime: "8 min read",
    sections: [
      {
        heading: "Math is spatial",
        body: [
          "Math notes are not just words in a row. The position of a numerator, exponent, radical, arrow, or diagram can change the meaning. A plain text output may not preserve everything.",
          "When scanning math, users should expect to review equations more carefully than ordinary prose."
        ]
      },
      {
        heading: "Common OCR confusions",
        body: [
          "OCR may confuse x with a multiplication sign, b with 6, z with 2, or O with 0. Parentheses can disappear when they are written lightly.",
          "A correction system can use nearby context, but it should never replace an equation with a different known formula that was not written on the page."
        ]
      },
      {
        heading: "Capture tips for formulas",
        body: [
          "Use bright light and keep the camera parallel to the paper. If the page has many equations, avoid extreme angles because small symbols become distorted.",
          "For a dense page, scan closer sections separately if the full-page image makes the symbols too small."
        ]
      },
      {
        heading: "Use text and image together",
        body: [
          "The converted text is useful for search and editing, while the image preserves visual layout. For math notes, both are valuable.",
          "A good digital study record keeps enough visual context to recognize diagrams and enough text to search by topic."
        ]
      }
    ]
  }
];

export function getGuide(slug: string) {
  return guides.find((guide) => guide.slug === slug);
}
