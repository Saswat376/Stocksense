import crypto from 'crypto';

const TOKEN_SECRET = process.env.STOCKSENSE_SECRET || 'local-development-secret-change-before-deploy';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const digest = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256');
  return `${salt.toString('base64')}$${digest.toString('base64')}`;
}

export function verifyPassword(password, encoded) {
  try {
    const [saltB64, digestB64] = encoded.split('$');
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(digestB64, 'base64');
    const actual = crypto.pbkdf2Sync(password, salt, 310000, expected.length, 'sha256');
    return crypto.timingSafeEqual(actual, expected);
  } catch (e) {
    return false;
  }
}

function base64UrlEncode(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return JSON.parse(Buffer.from(str, 'base64').toString('utf8'));
}

export function issueToken(userId) {
  const payload = base64UrlEncode({ sub: String(userId), exp: Math.floor(Date.now()/1000) + 60*60*24*7 });
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

export function readToken(token) {
  try {
    const [payload, signature] = token.split('.');
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const data = base64UrlDecode(payload);
    if (data.exp < Math.floor(Date.now()/1000)) return null;
    return Number(data.sub);
  } catch (e) {
    return null;
  }
}
