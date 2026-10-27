import { createHash } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { isAdmin } from '@/lib/admin';
import { deleteNote, saveNote, validId } from '@/lib/store';

const GROUPS = new Set(['team', 'group', 'partner']);
const TONES = new Set(['linen', 'sage', 'fog', 'blush', 'night']);
const TEXT_FIELDS: Record<string, number> = { name: 20, org: 30, message: 400 };

// 화면은 브라우저마다 수정 열쇠(48자 hex)를 만들어 보관한다 — 서버는 그 지문만 저장한다
function tokenHashOf(req: NextApiRequest): string | null {
  const t = req.headers['x-edit-token'];
  if (typeof t !== 'string' || !/^[a-f0-9]{48}$/.test(t)) return null;
  return createHash('sha256').update(t).digest('hex');
}

function clean(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, max] of Object.entries(TEXT_FIELDS)) {
    const v = b[k] ?? '';
    if (typeof v !== 'string' || v.length > max) return null;
    out[k] = v.trim();
  }
  if (!out.name || !out.message) return null;
  out.group = GROUPS.has(String(b.group)) ? b.group : 'team';
  out.tone = TONES.has(String(b.tone)) ? b.tone : 'linen';
  const now = Date.now();
  out.createdAt = typeof b.createdAt === 'number' && b.createdAt > 0 && b.createdAt <= now + 60_000 ? b.createdAt : now;
  out.updatedAt = now;
  return out;
}

/** PUT·DELETE /api/notes/<id> — 카드 저장(본인)·삭제(본인 또는 관리자) */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id);
  if (!validId(id)) return res.status(400).json({ detail: '잘못된 요청이에요.' });
  const tokenHash = tokenHashOf(req);

  try {
    if (req.method === 'PUT') {
      if (!tokenHash) return res.status(400).json({ detail: '잘못된 요청이에요. 새로고침 후 다시 시도해주세요.' });
      const data = clean(req.body);
      if (!data) return res.status(400).json({ detail: '이름과 메시지를 확인해주세요.' });
      if (!(await saveNote(id, data, tokenHash))) return res.status(403).json({ detail: '이 카드는 처음 쓴 브라우저에서만 고칠 수 있어요.' });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      if (!(await deleteNote(id, tokenHash, isAdmin(req)))) return res.status(403).json({ detail: '이 카드는 지울 권한이 없어요.' });
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ detail: '허용되지 않는 요청이에요.' });
  } catch (e) {
    console.error('카드 저장 실패', e);
    return res.status(500).json({ detail: '저장하지 못했어요. 잠시 후 다시 시도해주세요.' });
  }
}
