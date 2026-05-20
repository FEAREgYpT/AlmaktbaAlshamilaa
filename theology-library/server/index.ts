import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import type { Server } from 'http';
import { getDb } from './db/connection';
import categories from './routes/categories';
import subtopics from './routes/subtopics';
import testaments from './routes/testaments';
import books from './routes/books';
import chapters from './routes/chapters';
import imageSets from './routes/imageSets';
import images from './routes/images';
import videos from './routes/videos';
import texts from './routes/texts';
import crossLinks from './routes/crossLinks';
import search from './routes/search';

let serverRef: Server | null = null;

export async function startServer(port: number, dataPath: string): Promise<void> {
  const app = express();
  const db = getDb(dataPath);
  const imgDir = path.join(dataPath, 'images');
  fs.mkdirSync(imgDir, { recursive: true });
  const upload = multer({ dest: imgDir });

  app.use(cors({ origin: true }));
  app.use(express.json());
  app.use('/assets', express.static(path.join(dataPath, 'assets')));
  app.use((req, _res, next) => {
    (req as any).db = db;
    (req as any).upload = upload;
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/categories', categories);
  app.use('/api/subtopics', subtopics);
  app.use('/api/testaments', testaments);
  app.use('/api/books', books);
  app.use('/api/chapters', chapters);
  app.use('/api/image-sets', imageSets);
  app.use('/api/images', images);
  app.use('/api/videos', videos);
  app.use('/api/texts', texts);
  app.use('/api/cross-links', crossLinks);
  app.use('/api/search', search);

  await new Promise<void>((resolve) => {
    serverRef = app.listen(port, () => resolve());
  });
}

export async function stopServer(): Promise<void> {
  if (!serverRef) return;
  await new Promise<void>((resolve, reject) => {
    serverRef?.close((err) => (err ? reject(err) : resolve()));
  });
  serverRef = null;
}
