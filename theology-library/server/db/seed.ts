import Database from 'better-sqlite3';

type TestamentSeed = {
  name_ar: string;
  name_en: string;
  order_index: number;
};

type BookSeed = {
  testament_order: number;
  name_ar: string;
  name_en: string;
  book_order: number;
  chapter_count: number;
};

const TESTAMENTS: TestamentSeed[] = [
  { name_ar: 'العهد القديم', name_en: 'Old Testament', order_index: 1 },
  { name_ar: 'العهد الجديد', name_en: 'New Testament', order_index: 2 }
];

const BOOKS: BookSeed[] = [
  { testament_order: 1, name_ar: 'التكوين', name_en: 'Genesis', book_order: 1, chapter_count: 50 },
  { testament_order: 1, name_ar: 'الخروج', name_en: 'Exodus', book_order: 2, chapter_count: 40 },
  { testament_order: 1, name_ar: 'اللاويين', name_en: 'Leviticus', book_order: 3, chapter_count: 27 },
  { testament_order: 1, name_ar: 'العدد', name_en: 'Numbers', book_order: 4, chapter_count: 36 },
  { testament_order: 1, name_ar: 'التثنية', name_en: 'Deuteronomy', book_order: 5, chapter_count: 34 },
  { testament_order: 2, name_ar: 'متى', name_en: 'Matthew', book_order: 40, chapter_count: 28 },
  { testament_order: 2, name_ar: 'مرقس', name_en: 'Mark', book_order: 41, chapter_count: 16 },
  { testament_order: 2, name_ar: 'لوقا', name_en: 'Luke', book_order: 42, chapter_count: 24 },
  { testament_order: 2, name_ar: 'يوحنا', name_en: 'John', book_order: 43, chapter_count: 21 },
  { testament_order: 2, name_ar: 'الرؤيا', name_en: 'Revelation', book_order: 66, chapter_count: 22 }
];

const THEMATIC_CATEGORIES = [
  { name_ar: 'لاهوت الله', name_en: 'Doctrine of God', order_index: 1 },
  { name_ar: 'الخلاص', name_en: 'Salvation', order_index: 2 },
  { name_ar: 'الكنيسة', name_en: 'The Church', order_index: 3 }
];

export function seedDatabase(db: Database.Database): void {
  const insertTestament = db.prepare(
    `INSERT INTO testaments (name_ar, name_en, order_index)
     VALUES (@name_ar, @name_en, @order_index)`
  );
  const insertBook = db.prepare(
    `INSERT INTO books (testament_id, name_ar, name_en, book_order, chapter_count)
     VALUES (@testament_id, @name_ar, @name_en, @book_order, @chapter_count)`
  );
  const insertChapter = db.prepare(
    `INSERT INTO chapters (book_id, chapter_number, title_ar, title_en, summary)
     VALUES (@book_id, @chapter_number, @title_ar, @title_en, @summary)`
  );
  const insertCategory = db.prepare(
    `INSERT INTO categories (name_ar, name_en, description, order_index)
     VALUES (@name_ar, @name_en, @description, @order_index)`
  );
  const insertTopic = db.prepare(
    `INSERT INTO sub_topics (category_id, title_ar, title_en, summary, rich_text_content, keywords_array, order_index, is_published)
     VALUES (@category_id, @title_ar, @title_en, @summary, @rich_text_content, @keywords_array, @order_index, 1)`
  );

  const tx = db.transaction(() => {
    for (const testament of TESTAMENTS) insertTestament.run(testament);

    const testamentIdByOrder = new Map<number, number>();
    for (const row of db.prepare('SELECT id, order_index FROM testaments').all() as Array<{id:number; order_index:number;}>) {
      testamentIdByOrder.set(row.order_index, row.id);
    }

    for (const book of BOOKS) {
      const testamentId = testamentIdByOrder.get(book.testament_order);
      if (!testamentId) throw new Error(`Missing testament mapping for order ${book.testament_order}`);
      const bookResult = insertBook.run({ ...book, testament_id: testamentId });
      const bookId = Number(bookResult.lastInsertRowid);
      for (let chapter = 1; chapter <= Math.min(book.chapter_count, 3); chapter++) {
        insertChapter.run({
          book_id: bookId,
          chapter_number: chapter,
          title_ar: `إصحاح ${chapter}`,
          title_en: `Chapter ${chapter}`,
          summary: `Sample seeded chapter ${chapter} for ${book.name_en}`
        });
      }
    }

    for (const category of THEMATIC_CATEGORIES) {
      const categoryResult = insertCategory.run({ ...category, description: `Core topic: ${category.name_en}` });
      const categoryId = Number(categoryResult.lastInsertRowid);
      insertTopic.run({
        category_id: categoryId,
        title_ar: `${category.name_ar} — مقدمة`,
        title_en: `${category.name_en} — Introduction`,
        summary: `Seeded introductory article for ${category.name_en}`,
        rich_text_content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: category.name_en }] }] }),
        keywords_array: JSON.stringify([category.name_en.toLowerCase(), 'seed']),
        order_index: 1
      });
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_categories_parent_order ON categories(parent_id, order_index);
      CREATE INDEX IF NOT EXISTS idx_books_testament_order ON books(testament_id, book_order);
      CREATE INDEX IF NOT EXISTS idx_chapters_book_chapter ON chapters(book_id, chapter_number);
      CREATE INDEX IF NOT EXISTS idx_sub_topics_category_order ON sub_topics(category_id, order_index);
      CREATE INDEX IF NOT EXISTS idx_cross_links_from ON cross_links(from_type, from_id);
      CREATE INDEX IF NOT EXISTS idx_cross_links_to ON cross_links(to_type, to_id);
    `);
  });

  tx();
}
