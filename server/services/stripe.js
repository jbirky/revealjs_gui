// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || 'price_1TVnpZF9LOeD1Xd0coGVd0fI'

let stripe = null
function getStripe() {
  if (!stripe && STRIPE_SECRET_KEY) {
    stripe = require('stripe')(STRIPE_SECRET_KEY)
  }
  return stripe
}

function isEnabled() {
  return !!(STRIPE_SECRET_KEY && STRIPE_PRO_PRICE_ID)
}

async function getOrCreateCustomer(storage, userId, email, name) {
  const s = getStripe()
  const { rows } = await storage.query('SELECT stripe_customer_id FROM users WHERE id = $1', [userId])
  if (rows[0]?.stripe_customer_id) return rows[0].stripe_customer_id

  const customer = await s.customers.create({
    email,
    name,
    metadata: { parallax_user_id: userId },
  })
  await storage.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customer.id, userId])
  return customer.id
}

async function createCheckoutSession(storage, userId, email, name, successUrl, cancelUrl) {
  const s = getStripe()
  const customerId = await getOrCreateCustomer(storage, userId, email, name)
  const session = await s.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: STRIPE_PRO_PRICE_ID, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { parallax_user_id: userId },
  })
  return session
}

async function createPortalSession(storage, userId) {
  const s = getStripe()
  const { rows } = await storage.query('SELECT stripe_customer_id FROM users WHERE id = $1', [userId])
  if (!rows[0]?.stripe_customer_id) throw new Error('No Stripe customer')
  const session = await s.billingPortal.sessions.create({
    customer: rows[0].stripe_customer_id,
    return_url: process.env.APP_URL || 'https://parallax-presentations.com/dashboard',
  })
  return session
}

async function handleWebhook(storage, rawBody, signature) {
  const s = getStripe()
  const event = s.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      if (session.mode === 'subscription') {
        const customerId = session.customer
        const subscriptionId = session.subscription
        await storage.query(
          `UPDATE users SET plan = 'pro', stripe_subscription_id = $1, plan_expires_at = NULL WHERE stripe_customer_id = $2`,
          [subscriptionId, customerId]
        )
      }
      break
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object
      const status = sub.status
      if (status === 'active') {
        await storage.query(
          `UPDATE users SET plan = 'pro', plan_expires_at = NULL WHERE stripe_customer_id = $1`,
          [sub.customer]
        )
      } else if (status === 'past_due' || status === 'unpaid') {
        // keep pro for now, but could downgrade after grace period
      }
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object
      await storage.query(
        `UPDATE users SET plan = 'free', stripe_subscription_id = NULL, plan_expires_at = NULL WHERE stripe_customer_id = $1`,
        [sub.customer]
      )
      break
    }
  }

  return event
}

module.exports = { isEnabled, createCheckoutSession, createPortalSession, handleWebhook, getStripe }
