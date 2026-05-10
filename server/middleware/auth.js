// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const IS_CLOUD = process.env.PARALLAX_MODE === 'cloud'

let clerkMiddleware, requireAuth, getAuth

if (IS_CLOUD) {
  const clerk = require('@clerk/express')
  clerkMiddleware = clerk.clerkMiddleware()
  requireAuth = clerk.requireAuth()
  getAuth = clerk.getAuth
}

// Attaches req.userId to every request.
// Cloud mode: extracts from Clerk JWT (rejects unauthenticated requests on protected routes).
// Self-hosted mode: sets req.userId = null (single-user, no auth).
function attachUserId(req, res, next) {
  if (IS_CLOUD) {
    const auth = getAuth(req)
    req.userId = auth?.userId || null
  } else {
    req.userId = null
  }
  next()
}

// Middleware that rejects unauthenticated requests in cloud mode.
// In self-hosted mode, it's a no-op passthrough.
function requireUser(req, res, next) {
  if (!IS_CLOUD) return next()
  if (!req.userId) return res.status(401).json({ error: 'Authentication required' })
  next()
}

// Returns the middleware stack to apply to the Express app.
// Cloud mode: Clerk session parser → userId extractor.
// Self-hosted: just the userId extractor (sets null).
function authStack() {
  if (IS_CLOUD) {
    return [clerkMiddleware, attachUserId]
  }
  return [attachUserId]
}

const PLAN_LIMITS = {
  free: { maxPresentations: 3, expirationDays: 30 },
  pro:  { maxPresentations: Infinity, expirationDays: null },
  team: { maxPresentations: Infinity, expirationDays: null },
}

module.exports = { authStack, requireUser, IS_CLOUD, PLAN_LIMITS }
