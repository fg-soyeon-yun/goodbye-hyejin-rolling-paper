import { promises as fs } from 'fs';
import path from 'path';

/**
 * 롤링페이퍼 카드 저장소. `<APP_DATA_DIR>/notes.json` 한 파일에 `{ [id]: note }` 로 쌓는다.
 * 컨테이너가 재배포돼도 남도록 APP_DATA_DIR(기본 /app/data)에 Coolify 영구볼륨을 마운트해야 한다.
 */
const DATA_DIR = process.env.APP_DATA_DIR || path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'notes.json');

// 화면이 브라우저마다 만드는 카드 번호(24자 hex)
const ID_RE = /^[a-f0-9]{24}$/;

export type Note = Record<string, unknown> & { tokenHash: string };

let queue: Promise<unknown> = Promise.resolve();

// 쓰기는 한 번에 하나씩 — 동시에 두 사람이 저장해도 파일이 깨지지 않게 순서대로 처리한다
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function readAll(): Promise<Record<string, Note>> {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw e;
  }
}

async function writeAll(all: Record<string, Note>) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(all), 'utf8');
  await fs.rename(tmp, FILE);
}

export function validId(id: string) {
  return ID_RE.test(id);
}

// 수정 열쇠 지문(tokenHash)은 화면에 내보내지 않는다
export async function listNotes() {
  const all = await serial(readAll);
  return Object.entries(all).map(([id, note]) => {
    const { tokenHash: _hidden, ...data } = note;
    return { id, data };
  });
}

/** 새 카드는 누구나, 이미 있는 카드는 같은 수정 열쇠를 가진 사람만 고친다. 열쇠가 다르면 false */
export function saveNote(id: string, data: Record<string, unknown>, tokenHash: string) {
  return serial(async () => {
    const all = await readAll();
    const prev = all[id];
    if (prev && prev.tokenHash !== tokenHash) return false;
    all[id] = { ...data, createdAt: prev?.createdAt ?? data.createdAt, tokenHash };
    await writeAll(all);
    return true;
  });
}

/** 본인(같은 수정 열쇠) 또는 관리자만 지운다. 권한이 없으면 false */
export function deleteNote(id: string, tokenHash: string | null, admin: boolean) {
  return serial(async () => {
    const all = await readAll();
    const prev = all[id];
    if (!prev) return true;
    if (!admin && prev.tokenHash !== tokenHash) return false;
    delete all[id];
    await writeAll(all);
    return true;
  });
}
