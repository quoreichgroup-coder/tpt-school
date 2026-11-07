import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/db'

const ACCESS_LIFETIME_SECONDS = 60 * 60
const REFRESH_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000

function secret() {
  const value = process.env.AUTH_SECRET
  if (!value || value.length < 32) throw new Error('AUTH_SECRET must contain at least 32 characters')
  return value
}

function signature(input: string) {
  return createHmac('sha256', secret()).update(input).digest('base64url')
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function createAccessToken(userId: string, sessionId: string) {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ sub: userId, sid: sessionId, iat: now, exp: now + ACCESS_LIFETIME_SECONDS, aud: 'tpt-mobile' })).toString('base64url')
  const input = `${header}.${payload}`
  return `${input}.${signature(input)}`
}

export async function createMobileSession(userId: string) {
  const refreshToken = randomBytes(32).toString('base64url')
  const session = await db.mobileSession.create({
    data: {
      userId,
      refreshTokenHash: tokenHash(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_LIFETIME_MS),
    },
  })
  return {
    accessToken: createAccessToken(userId, session.id),
    expiresIn: ACCESS_LIFETIME_SECONDS,
    refreshToken,
  }
}

export async function rotateMobileSession(refreshToken: string) {
  const now = new Date()
  const nextRefreshToken = randomBytes(32).toString('base64url')
  const result = await db.$transaction(async tx => {
    const oldSession = await tx.mobileSession.findUnique({
      where: { refreshTokenHash: tokenHash(refreshToken) },
      include: { user: { select: { id: true, email: true, name: true, role: true, avatar: true, active: true } } },
    })
    if (!oldSession || oldSession.revokedAt || oldSession.expiresAt <= now || !oldSession.user.active) return null

    const revoked = await tx.mobileSession.updateMany({
      where: { id: oldSession.id, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    })
    if (revoked.count !== 1) return null

    const nextSession = await tx.mobileSession.create({
      data: {
        userId: oldSession.userId,
        refreshTokenHash: tokenHash(nextRefreshToken),
        expiresAt: new Date(Date.now() + REFRESH_LIFETIME_MS),
      },
    })
    return { user: oldSession.user, sessionId: nextSession.id }
  })

  if (!result) return null
  return {
    ...createMobileSessionResponse(result.user.id, result.sessionId),
    refreshToken: nextRefreshToken,
    user: { id: result.user.id, email: result.user.email, name: result.user.name, role: result.user.role, avatar: result.user.avatar },
  }
}

function createMobileSessionResponse(userId: string, sessionId: string) {
  return { accessToken: createAccessToken(userId, sessionId), expiresIn: ACCESS_LIFETIME_SECONDS }
}

export async function revokeMobileSession(refreshToken: string) {
  await db.mobileSession.updateMany({
    where: { refreshTokenHash: tokenHash(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export async function getMobileUser(authorization: string | null) {
  if (!authorization?.startsWith('Bearer ')) return null
  const token = authorization.slice(7)
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const input = `${parts[0]}.${parts[1]}`
  const expected = Buffer.from(signature(input))
  const actual = Buffer.from(parts[2])
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    if (payload.aud !== 'tpt-mobile' || !payload.sub || !payload.sid || payload.exp <= Date.now() / 1000) return null
    const session = await db.mobileSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { is: { active: true } },
      },
      select: { user: { select: { id: true, email: true, name: true, role: true, avatar: true } } },
    })
    return session?.user ?? null
  } catch {
    return null
  }
}
