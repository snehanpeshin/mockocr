type LocalNote = { id: string; filename: string; createdAt: string; text: string; imageData?: string };
type LocalCreation = { createdAt: string; title: string; childName: string; image: string };
export type LocalScrapbookPage = { id: string; title: string; createdAt: string; text: string; imageData: string };

export function collectLocalScrapbook(notes: LocalNote[], drawings: LocalCreation[]): LocalScrapbookPage[] {
  const pages = new Map<string, LocalScrapbookPage>();
  notes.forEach((note) => {
    if (note.imageData) pages.set(note.id, { id: note.id, title: note.filename.slice(0, 200),
      createdAt: note.createdAt, text: note.text.slice(0, 2000), imageData: note.imageData });
  });
  drawings.forEach((drawing) => {
    const id = `kids-${drawing.createdAt}`;
    if (drawing.image && !pages.has(id)) pages.set(id, { id,
      title: `${drawing.childName} - ${drawing.title}`.slice(0, 200), createdAt: drawing.createdAt,
      text: drawing.title.slice(0, 2000), imageData: drawing.image });
  });
  return Array.from(pages.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
