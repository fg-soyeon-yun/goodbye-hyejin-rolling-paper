import type { NextApiRequest, NextApiResponse } from 'next';
import { listNotes } from '@/lib/store';

/** GET /api/notes — 롤링페이퍼 카드 목록 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ detail: '허용되지 않는 요청이에요.' });
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ docs: await listNotes() });
  } catch (e) {
    console.error('카드 목록 읽기 실패', e);
    return res.status(500).json({ detail: '저장된 카드를 읽지 못했어요.' });
  }
}
