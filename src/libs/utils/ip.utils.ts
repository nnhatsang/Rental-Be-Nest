import { detect } from 'detect-browser';
import { Request } from 'express';

export function getIp(req: Request) {
  return (
    req.headers['cf-connecting-ip']?.toString() ||
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    (req as any).ip
  )?.replace(/^::ffff:/, '');
}

export function isBrowserUA(ua?: string) {
  const result = detect(ua ?? '');
  return !!result;
}
