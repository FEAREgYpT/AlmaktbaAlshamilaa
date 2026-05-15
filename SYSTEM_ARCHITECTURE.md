# Sovereign Theology Library — Full System Architecture (v2.0)

## 1) Complete Database ERD

### 1.1 Core Modeling Principles
- Bilingual-first columns (`*_ar`, `*_en`) on user-facing entities.
- Strong relational integrity with explicit FK constraints and cascades.
- Track A (Thematic) and Track B (Biblical) modeled independently, then intersected via `cross_links`.
- Multimedia is polymorphic by design intent, but implemented with nullable FKs to `sub_topics` and `chapters` to preserve SQL simplicity and performance.
- Search is hybrid: denormalized `search_index` + direct FTS on source tables.

---

### 1.2 Tables, Columns, Keys, Indexes, Relationships

## `categories`
Represents hierarchical thematic categories (parent/child tree).

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | PK |
| name_ar | VARCHAR(255) | NOT NULL |
| name_en | VARCHAR(255) | NOT NULL |
| description | TEXT | NULL |
| parent_id | BIGINT | NULL, FK -> categories.id ON DELETE SET NULL |
| order_index | INT | NOT NULL DEFAULT 0 |
| icon | VARCHAR(100) | NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes**
- `idx_categories_parent_id (parent_id)`
- `idx_categories_order (parent_id, order_index)`
- `idx_categories_name_ar_trgm USING gin (name_ar gin_trgm_ops)`
- `idx_categories_name_en_trgm USING gin (name_en gin_trgm_ops)`

**Relationship**
- `categories (1) -> (M) categories` (self-referential tree)
- `categories (1) -> (M) sub_topics`

---

## `sub_topics`
Track A unit (leaf-level theological topic).

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | PK |
| category_id | BIGINT | NOT NULL, FK -> categories.id ON DELETE CASCADE |
| title_ar | VARCHAR(255) | NOT NULL |
| title_en | VARCHAR(255) | NOT NULL |
| summary | TEXT | NULL |
| rich_text_content | JSONB | NOT NULL DEFAULT '{}'::jsonb |
| keywords_array | TEXT[] | NOT NULL DEFAULT '{}' |
| order_index | INT | NOT NULL DEFAULT 0 |
| is_published | BOOLEAN | NOT NULL DEFAULT false |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes**
- `idx_sub_topics_category (category_id, order_index)`
- `idx_sub_topics_keywords_gin USING gin (keywords_array)`
- `idx_sub_topics_title_ar_trgm USING gin (title_ar gin_trgm_ops)`
- `idx_sub_topics_title_en_trgm USING gin (title_en gin_trgm_ops)`
- `idx_sub_topics_content_gin USING gin (to_tsvector('simple', coalesce(rich_text_content::text,'')))`
- Partial index: `idx_sub_topics_published (is_published) WHERE is_published = true`

**Relationship**
- `categories (1) -> (M) sub_topics`
- `sub_topics (1) -> (M) image_sets`
- `sub_topics (1) -> (M) videos`
- `sub_topics (1) -> (M) texts`
- `sub_topics (M) <-> (M) chapters` via `cross_links`

---

## `testaments`
Top biblical partition.

| Column | Type | Constraints |
|---|---|---|
| id | SMALLSERIAL | PK |
| name_ar | VARCHAR(100) | NOT NULL UNIQUE |
| name_en | VARCHAR(100) | NOT NULL UNIQUE |

**Relationship**
- `testaments (1) -> (M) books`

---

## `books`
Bible book metadata (1..66).

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | PK |
| testament_id | SMALLINT | NOT NULL, FK -> testaments.id ON DELETE RESTRICT |
| name_ar | VARCHAR(150) | NOT NULL |
| name_en | VARCHAR(150) | NOT NULL |
| abbreviation | VARCHAR(20) | NOT NULL |
| book_order | SMALLINT | NOT NULL UNIQUE CHECK (book_order BETWEEN 1 AND 66) |
| description | TEXT | NULL |

**Indexes**
- `idx_books_testament_order (testament_id, book_order)`
- `idx_books_name_ar_trgm USING gin (name_ar gin_trgm_ops)`
- `idx_books_name_en_trgm USING gin (name_en gin_trgm_ops)`

**Relationship**
- `testaments (1) -> (M) books`
- `books (1) -> (M) chapters`

---

## `chapters`
Track B chapter unit + resource hub anchor.

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | PK |
| book_id | BIGINT | NOT NULL, FK -> books.id ON DELETE CASCADE |
| chapter_number | INT | NOT NULL CHECK (chapter_number > 0) |
| title | VARCHAR(255) | NULL |
| summary | TEXT | NULL |
| keywords_array | TEXT[] | NOT NULL DEFAULT '{}' |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Constraints**
- UNIQUE `(book_id, chapter_number)`

**Indexes**
- `idx_chapters_book_number (book_id, chapter_number)`
- `idx_chapters_keywords_gin USING gin (keywords_array)`
- `idx_chapters_summary_tsv USING gin (to_tsvector('simple', coalesce(summary,'')))`

**Relationship**
- `books (1) -> (M) chapters`
- `chapters (1) -> (M) image_sets`
- `chapters (1) -> (M) videos`
- `chapters (1) -> (M) texts`
- `chapters (M) <-> (M) sub_topics` via `cross_links`

---

## `image_sets`
Visual wing group by source/reference.

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | PK |
| title | VARCHAR(255) | NOT NULL |
| source_reference | VARCHAR(500) | NOT NULL |
| description | TEXT | NULL |
| linked_sub_topic_id | BIGINT | NULL, FK -> sub_topics.id ON DELETE SET NULL |
| linked_chapter_id | BIGINT | NULL, FK -> chapters.id ON DELETE SET NULL |
| keywords_array | TEXT[] | NOT NULL DEFAULT '{}' |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Constraint**
- CHECK `(linked_sub_topic_id IS NOT NULL OR linked_chapter_id IS NOT NULL)`

**Indexes**
- `idx_image_sets_subtopic (linked_sub_topic_id)`
- `idx_image_sets_chapter (linked_chapter_id)`
- `idx_image_sets_keywords_gin USING gin (keywords_array)`
- `idx_image_sets_source_trgm USING gin (source_reference gin_trgm_ops)`

**Relationship**
- `image_sets (1) -> (M) images`
- Optional link to thematic and/or biblical anchor

---

## `images`
Individual media item within a set.

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | PK |
| image_set_id | BIGINT | NOT NULL, FK -> image_sets.id ON DELETE CASCADE |
| file_path | TEXT | NULL |
| url | TEXT | NULL |
| caption | TEXT | NULL |
| alt_text | TEXT | NULL |
| order_index | INT | NOT NULL DEFAULT 0 |
| file_size | BIGINT | NULL |
| dimensions | JSONB | NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Constraint**
- CHECK `(file_path IS NOT NULL OR url IS NOT NULL)`

**Indexes**
- `idx_images_set_order (image_set_id, order_index)`

**Relationship**
- `image_sets (1) -> (M) images`

---

## `videos`
Video wing entity.

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | PK |
| title | VARCHAR(255) | NOT NULL |
| source_type | VARCHAR(20) | NOT NULL CHECK (source_type IN ('youtube','vimeo','local')) |
| url | TEXT | NOT NULL |
| embed_code | TEXT | NULL |
| thumbnail_url | TEXT | NULL |
| duration_seconds | INT | NULL CHECK (duration_seconds >= 0) |
| linked_sub_topic_id | BIGINT | NULL, FK -> sub_topics.id ON DELETE SET NULL |
| linked_chapter_id | BIGINT | NULL, FK -> chapters.id ON DELETE SET NULL |
| keywords_array | TEXT[] | NOT NULL DEFAULT '{}' |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Constraint**
- CHECK `(linked_sub_topic_id IS NOT NULL OR linked_chapter_id IS NOT NULL)`

**Indexes**
- `idx_videos_subtopic (linked_sub_topic_id)`
- `idx_videos_chapter (linked_chapter_id)`
- `idx_videos_keywords_gin USING gin (keywords_array)`
- `idx_videos_title_trgm USING gin (title gin_trgm_ops)`

---

## `texts`
Standalone text references (commentary/excerpts/papers).

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | PK |
| title | VARCHAR(255) | NOT NULL |
| content | JSONB | NOT NULL DEFAULT '{}'::jsonb |
| author | VARCHAR(255) | NULL |
| source_reference | VARCHAR(500) | NULL |
| publication_date | DATE | NULL |
| linked_sub_topic_id | BIGINT | NULL, FK -> sub_topics.id ON DELETE SET NULL |
| linked_chapter_id | BIGINT | NULL, FK -> chapters.id ON DELETE SET NULL |
| keywords_array | TEXT[] | NOT NULL DEFAULT '{}' |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Constraint**
- CHECK `(linked_sub_topic_id IS NOT NULL OR linked_chapter_id IS NOT NULL)`

**Indexes**
- `idx_texts_subtopic (linked_sub_topic_id)`
- `idx_texts_chapter (linked_chapter_id)`
- `idx_texts_keywords_gin USING gin (keywords_array)`
- `idx_texts_title_trgm USING gin (title gin_trgm_ops)`
- `idx_texts_content_tsv USING gin (to_tsvector('simple', coalesce(content::text,'')))`

---

## `cross_links`
Intersection table between Track A and Track B.

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | PK |
| sub_topic_id | BIGINT | NOT NULL, FK -> sub_topics.id ON DELETE CASCADE |
| chapter_id | BIGINT | NOT NULL, FK -> chapters.id ON DELETE CASCADE |
| link_type | VARCHAR(100) | NOT NULL DEFAULT 'thematic_reference' |
| link_note | TEXT | NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Constraints**
- UNIQUE `(sub_topic_id, chapter_id, link_type)`

**Indexes**
- `idx_cross_links_subtopic (sub_topic_id)`
- `idx_cross_links_chapter (chapter_id)`

**Relationship**
- Implements `sub_topics (M) <-> (M) chapters`

---

## `search_index`
Materialized, denormalized search rows per entity.

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | PK |
| entity_type | VARCHAR(30) | NOT NULL CHECK (entity_type IN ('subtopic','chapter','image_set','video','text')) |
| entity_id | BIGINT | NOT NULL |
| title | TEXT | NOT NULL |
| keywords_array | TEXT[] | NOT NULL DEFAULT '{}' |
| full_text_content | TEXT | NOT NULL DEFAULT '' |
| track_type | VARCHAR(20) | NOT NULL CHECK (track_type IN ('thematic','biblical')) |
| relevance_weight | NUMERIC(5,2) | NOT NULL DEFAULT 1.00 |
| search_vector | TSVECTOR | GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(full_text_content,''))) STORED |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Constraints**
- UNIQUE `(entity_type, entity_id)`

**Indexes**
- `idx_search_index_entity (entity_type, entity_id)`
- `idx_search_index_track (track_type)`
- `idx_search_index_keywords_gin USING gin (keywords_array)`
- `idx_search_index_tsv USING gin (search_vector)`
- `idx_search_index_title_trgm USING gin (title gin_trgm_ops)`
- `idx_search_index_fulltext_trgm USING gin (full_text_content gin_trgm_ops)`

---

### 1.3 ERD Relationship Summary (Cardinality)
- `categories 1—M sub_topics`
- `categories 1—M categories` (self tree)
- `testaments 1—M books`
- `books 1—M chapters`
- `sub_topics M—M chapters` via `cross_links`
- `sub_topics 1—M image_sets/videos/texts` (optional linkage)
- `chapters 1—M image_sets/videos/texts` (optional linkage)
- `image_sets 1—M images`

---

### 1.4 Why PostgreSQL over MongoDB for this specific system
PostgreSQL is the better fit because:
1. **High-integrity many-to-many cross-linking**: `sub_topics <-> chapters` with uniqueness and FK safety is native and robust.
2. **Hierarchical + relational querying together**: recursive CTE for category trees plus multi-join analytical queries.
3. **Advanced search inside same engine**: `tsvector`, GIN, trigram (`pg_trgm`) avoids extra infra for v1/v2.
4. **Transactional consistency**: adding a sub-topic + links + media + index row can be one ACID transaction.
5. **Schema discipline for bilingual content**: explicit typed columns, constraints, and migration safety.
6. **Performance predictability**: indexed joins outperform document fan-out for cross-track reporting.

MongoDB could store documents flexibly, but cross-track referential integrity, deduped intersections, and ranking queries become more application-heavy and error-prone.

---

## 2) Full API Endpoints Specification (Node.js + Express + TypeScript)

Base URL: `/api`

### 2.1 Thematic Track

### GET `/categories`
**Query**: `includeChildren?: boolean`

**Response 200**
```json
{
  "data": [
    {
      "id": 1,
      "name_ar": "الصلب والفداء",
      "name_en": "Crucifixion & Atonement",
      "parent_id": null,
      "order_index": 1,
      "icon": "cross"
    }
  ]
}
```

### GET `/categories/:id/subtopics`
**Params**: `id:number`

**Response 200**
```json
{
  "data": [
    {
      "id": 10,
      "category_id": 1,
      "title_ar": "المنظور الطبي للمسامير",
      "title_en": "Medical Perspective of the Nails",
      "summary": "...",
      "keywords_array": ["الجلجثة", "crucifixion"],
      "is_published": true
    }
  ]
}
```

### GET `/subtopics/:id`
Returns full subtopic + all wings.

**Response 200**
```json
{
  "data": {
    "subtopic": {"id": 10, "title_ar": "...", "rich_text_content": {}},
    "texts": [],
    "image_sets": [{"id": 501, "images": []}],
    "videos": [],
    "cross_links": [{"chapter_id": 2701, "book": "Matthew", "chapter_number": 27}]
  }
}
```

### POST `/subtopics`
**Body**
```json
{
  "category_id": 1,
  "title_ar": "المنظور الطبي",
  "title_en": "Medical Perspective",
  "summary": "...",
  "rich_text_content": {},
  "keywords_array": ["الصلب", "الجلجثة"],
  "order_index": 2,
  "is_published": true
}
```
**Response 201**: `{ "data": { ...createdSubtopic } }`

### PUT `/subtopics/:id`
Partial updates allowed.

### DELETE `/subtopics/:id`
Soft delete recommended (`is_published=false` + archive flag) or hard delete.

---

### 2.2 Biblical Track

### GET `/testaments`
Returns old/new testaments.

### GET `/testaments/:id/books`
Returns all books ordered by `book_order`.

### GET `/books/:id/chapters`
Returns chapter list.

### GET `/chapters/:id`
Returns chapter + resource hub (texts/images/videos/cross-links).

### POST `/chapters/:id/resources`
Generic resource attach endpoint.

**Body**
```json
{
  "resource_type": "text",
  "payload": {
    "title": "Patristic Commentary",
    "content": {},
    "author": "John Chrysostom"
  }
}
```

---

### 2.3 Multimedia

### GET `/image-sets/:id`
Returns image set + nested images.

### POST `/image-sets`
Create image set.

### POST `/image-sets/:id/images`
Upload metadata or URL reference.

### GET `/videos`
**Query filters**: `source_type`, `sub_topic_id`, `chapter_id`, `q`.

### POST `/videos`
Create video record.

---

### 2.4 Cross-Linking

### POST `/cross-links`
**Body**
```json
{
  "sub_topic_id": 10,
  "chapter_id": 2701,
  "link_type": "prophetic_fulfillment",
  "link_note": "Direct thematic relation"
}
```

### GET `/subtopics/:id/chapters`
All linked chapters for sub-topic.

### GET `/chapters/:id/subtopics`
All linked sub-topics for chapter.

---

### 2.5 Search Engine API

### GET `/search?q={query}&track={thematic|biblical|all}`
**Response 200**
```json
{
  "thematic": [
    {"type": "subtopic", "id": 10, "title": "موقع الصلب", "score": 0.95, "excerpt": "..."}
  ],
  "biblical": [
    {"type": "chapter", "id": 2701, "book": "متى", "chapter": 27, "score": 0.88, "excerpt": "..."}
  ],
  "combined_score": 0.915
}
```

### GET `/search/keywords?prefix={letters}`
Autocomplete from aggregated keywords.

### POST `/search/rebuild-index`
Admin endpoint to rebuild `search_index`.

---

## 3) Search Algorithm + Keyword Strategy

### 3.1 Indexing Design
1. Enable extensions:
   - `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
   - `CREATE EXTENSION IF NOT EXISTS unaccent;`
2. Build `tsvector` for:
   - `title_ar`, `title_en`
   - `rich_text_content` / text content
   - `keywords_array` (joined text)
3. Arabic support:
   - Prefer `'arabic'` dictionary when acceptable stemming quality.
   - Fallback `'simple'` for mixed Arabic/English theological terms.
4. Trigram indexes for partial matching/autocomplete on titles/keywords.

### 3.2 Ranking Formula
For each hit compute:
- `keyword_exact_score` (Priority 1): 1.0 if exact in `keywords_array`
- `title_score` (Priority 2): trigram + ts_rank on titles
- `content_score` (Priority 3): ts_rank on body text
- `linked_boost` (Priority 4): boost if linked entity has exact keyword

`final_score = 0.45*keyword_exact_score + 0.30*title_score + 0.20*content_score + 0.05*linked_boost`

### 3.3 Query Flow
1. Normalize query (trim, lowercase, unaccent).
2. Pull exact keyword matches first.
3. Run FTS over `search_index.search_vector`.
4. Run trigram similarity for fuzzy/partial terms.
5. Merge + de-duplicate by `(entity_type, entity_id)`.
6. Compute `final_score` and split into thematic/biblical buckets.

### 3.4 Keyword Cloud
- Materialized table `keyword_stats(keyword, freq, entity_count, updated_at)`.
- Update via trigger or async queue on content mutations.
- Weight suggestion score: `ln(freq + 1) + 0.3*entity_count`.

---

## 4) UI/UX Wireframe Description

### 4.1 Global Layout
- **Left Sidebar (collapsible tree)**
  - 📚 الموضوعات / Thematic Track
    - Category -> Sub-topic -> Wings
  - 📖 الكتاب المقدس / Biblical Track
    - Testament -> Book -> Chapter -> Resources
- **Top Bar**
  - Global bilingual search input
  - Track/content-type filters
  - Theme toggle (Light/Dark)
  - Language toggle (AR/EN)
- **Main Content Panel**
  - Context header (breadcrumb + quick actions)
  - Tabbed content viewer

### 4.2 Content Tabs
1. 📝 Texts
2. 🖼 Images (grouped by source reference)
3. 🎬 Videos
4. 🔗 Cross-links

### 4.3 Image Gallery UX
- Accordion by `source_reference`.
- Grid thumbnails with lazy loading.
- Full-screen lightbox on click (caption + metadata + next/prev).

### 4.4 Search Results UX
- Two-column result groups:
  - Left: thematic
  - Right: biblical
- Result cards: icon, title, excerpt, highlighted match badges.
- Sticky filter bar: track, content type, date/source.

### 4.5 RTL/Arabic UX requirements
- Full RTL mirroring when `lang=ar`.
- Arabic font stack (e.g., Cairo/Noto Naskh).
- Bidirectional text-safe components for mixed EN/AR terms.

---

## 5) Tech Stack Recommendation + Justification

## Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: **Fastify** (recommended)
  - Better throughput, schema-based validation, strong TS ergonomics.
- **ORM**: **Drizzle ORM** (recommended)
  - SQL-first modeling fits this relational design and advanced PostgreSQL features.
- **DB**: PostgreSQL
  - Referential integrity + joins + FTS + trigram in one engine.
- **Search**: PostgreSQL FTS + `pg_trgm`
  - Meilisearch optional at large scale (>1M documents, high QPS).
- **Storage**: start local filesystem; move to Cloudinary/S3-compatible object storage.
- **Auth**: JWT (single-user/small team), role claim for editor/viewer.

## Frontend
- **Framework**: Next.js + React + TypeScript (recommended)
  - App routing, optional SSR, excellent i18n and SEO flexibility.
- **Editor**: TipTap
  - JSON output, extensible schema for theological notes/footnotes.
- **Lightbox**: yet-another-react-lightbox
- **UI**: shadcn/ui + Radix primitives
- **State/Data**: TanStack Query + Zustand (UI local state)
- **RTL**: CSS logical properties + dir toggling at root.

---

## 6) Sample Seed Data (Structure in action)

```json
{
  "category": {
    "id": 1,
    "name_ar": "الصلب والفداء",
    "name_en": "Crucifixion & Atonement"
  },
  "sub_topic": {
    "id": 10,
    "category_id": 1,
    "title_ar": "المنظور الطبي للصلب",
    "title_en": "Medical Perspective of Crucifixion",
    "keywords_array": ["الجلجثة", "المسامير", "crucifixion"]
  },
  "linked_chapters": [
    {"book": "Matthew", "book_ar": "متى", "chapter_number": 27},
    {"book": "Isaiah", "book_ar": "إشعياء", "chapter_number": 53},
    {"book": "Psalms", "book_ar": "مزمور", "chapter_number": 22}
  ],
  "image_sets": [
    {"title": "Roman Crucifixion Artifacts", "source_reference": "British Museum Ref BM-CR-14", "images": 6},
    {"title": "Jerusalem Excavation Notes", "source_reference": "IAA Archive JER-EX-22", "images": 4},
    {"title": "Medical Diagrams", "source_reference": "Journal of Biblical Medicine 2018", "images": 8}
  ],
  "videos": [
    {"title": "Historical Crucifixion Methods", "source_type": "youtube", "duration_seconds": 1320},
    {"title": "Isaiah 53 Exegetical Lecture", "source_type": "vimeo", "duration_seconds": 2480}
  ]
}
```

---

## 7) Implementation Roadmap (First -> Last)

1. **Foundation**
   - Repo scaffolding, TypeScript config, linting, migrations framework.
2. **Database layer**
   - PostgreSQL schema + constraints + indexes + seed for testaments/books/chapters.
3. **Core APIs (read-first)**
   - Categories/subtopics + testaments/books/chapters read endpoints.
4. **Authoring APIs**
   - Create/update subtopics, texts, image sets/images, videos.
5. **Cross-link module**
   - Create/list cross-links from both sides.
6. **Search v1**
   - `search_index` population + `/search` + keyword autocomplete.
7. **Frontend shell**
   - Sidebar tree, top search bar, content panel tabs, RTL support.
8. **Media UX polish**
   - Source-grouped gallery + lightbox + video embeds.
9. **Search UX polish**
   - Split thematic/biblical results, highlights, filters.
10. **Hardening**
   - Auth, audit logs, validation, rate limiting, backup strategy.
11. **Performance pass**
   - Query profiling, index tuning, cache hot paths.
12. **Release**
   - Dockerized deployment, monitoring, observability dashboards.

