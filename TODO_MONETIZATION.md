# TODO: Monetization -- Stripe & RevenueCat Integration

> **App:** Writer (Inlay) -- React Native/Expo SDK 54, expo-router, AsyncStorage  
> **Backend:** Cloudflare Worker (`backend/worker.js`) proxying to OpenRouter  
> **Bundle ID:** `com.eliwking.myApp`  
> **Wrangler Worker Name:** `writer-app-proxy`

---

## Table of Contents

1. [Stripe Integration (Web Payments)](#stripe-integration-web-payments)
2. [RevenueCat Integration (iOS In-App Purchases)](#revenuecat-integration-ios-in-app-purchases)
3. [Cross-Platform Subscription Sync](#cross-platform-subscription-sync)
4. [Document Limit Enforcement](#document-limit-enforcement)
5. [AI Feature Gating](#ai-feature-gating)
6. [Testing Checklist](#testing-checklist)

---

## Tier Definitions (Reference)

| Feature | Free | Pro ($5/mo or $48/yr) | Team ($12/user/mo) |
|---|---|---|---|
| Documents | 5 | Unlimited | Unlimited |
| AI Autocomplete | 10 req/day | 500 req/day | 2000 req/day |
| Image Search/Gen | No | Yes | Yes |
| Export Options | Markdown only | All formats | All formats |
| Priority Support | No | Yes | Yes |

---

## Stripe Integration (Web Payments)

### Account & Dashboard Setup

- [ ] **Create Stripe account and configure dashboard**
  - Sign up at https://dashboard.stripe.com
  - Enable test mode for development
  - Configure business details and payout settings
  - Note the publishable key (`pk_test_...`) and secret key (`sk_test_...`)
  - Store `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as Wrangler secrets:
    ```bash
    npx wrangler secret put STRIPE_SECRET_KEY
    npx wrangler secret put STRIPE_WEBHOOK_SECRET
    ```

### Backend Integration

- [ ] **Install Stripe SDK or implement raw API calls in the Cloudflare Worker**
  - Cloudflare Workers cannot use `stripe-node` directly (Node.js APIs unavailable). Two options:
    1. **(Recommended)** Use Stripe's REST API directly with `fetch()` inside `backend/worker.js`
    2. **(Alternative)** Create a separate Node.js API (e.g., on Railway/Fly.io) that runs `stripe-node`
  - If using raw fetch, create a helper module `backend/stripe-helpers.js`:
    ```js
    // backend/stripe-helpers.js
    const STRIPE_API = 'https://api.stripe.com/v1';

    export async function stripeRequest(path, method, body, secretKey) {
      const response = await fetch(`${STRIPE_API}${path}`, {
        method,
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body ? new URLSearchParams(body).toString() : undefined,
      });
      return response.json();
    }

    export async function createCheckoutSession(params, secretKey) {
      return stripeRequest('/checkout/sessions', 'POST', {
        'mode': 'subscription',
        'success_url': params.successUrl,
        'cancel_url': params.cancelUrl,
        'customer_email': params.email,
        'line_items[0][price]': params.priceId,
        'line_items[0][quantity]': '1',
        'metadata[user_id]': params.userId,
      }, secretKey);
    }
    ```

- [ ] **Create Stripe Products and Prices for Free/Pro/Team tiers**
  - Create via Stripe Dashboard or API:
    ```bash
    # Pro Monthly
    curl https://api.stripe.com/v1/products \
      -u sk_test_...: \
      -d name="Writer Pro" \
      -d description="Unlimited documents and 500 AI requests/day"

    curl https://api.stripe.com/v1/prices \
      -u sk_test_...: \
      -d product=prod_XXXXX \
      -d unit_amount=999 \
      -d currency=usd \
      -d "recurring[interval]"=month

    # Pro Annual (2 months free)
    curl https://api.stripe.com/v1/prices \
      -u sk_test_...: \
      -d product=prod_XXXXX \
      -d unit_amount=9990 \
      -d currency=usd \
      -d "recurring[interval]"=year

    # Team Monthly
    curl https://api.stripe.com/v1/products \
      -u sk_test_...: \
      -d name="Writer Team" \
      -d description="Unlimited documents and 2000 AI requests/day"

    curl https://api.stripe.com/v1/prices \
      -u sk_test_...: \
      -d product=prod_YYYYY \
      -d unit_amount=1999 \
      -d currency=usd \
      -d "recurring[interval]"=month
    ```
  - Store Price IDs in wrangler.toml `[vars]` (these are not secrets):
    ```toml
    [vars]
    STRIPE_PRICE_PRO_MONTHLY = "price_XXXXX"
    STRIPE_PRICE_PRO_ANNUAL = "price_XXXXX"
    STRIPE_PRICE_TEAM_MONTHLY = "price_YYYYY"
    STRIPE_PRICE_TEAM_ANNUAL = "price_YYYYY"
    ```

- [ ] **Implement Stripe Checkout Session creation endpoint**
  - Add `POST /create-checkout-session` route in `backend/worker.js`:
    ```js
    case '/create-checkout-session': {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { priceId, userId, email } = await request.json();

      // Validate user is authenticated (check JWT/session)
      // ...

      const session = await createCheckoutSession({
        priceId,
        userId,
        email,
        successUrl: 'https://writer.app/subscription/success?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'https://writer.app/subscription/cancel',
      }, env.STRIPE_SECRET_KEY);

      return new Response(JSON.stringify({ url: session.url }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    ```

- [ ] **Build webhook handler for subscription lifecycle events**
  - Add `POST /stripe-webhook` route in `backend/worker.js`
  - Verify webhook signature using Stripe's signing secret (implement HMAC-SHA256 verification manually since `stripe-node` is not available):
    ```js
    async function verifyStripeSignature(payload, signature, secret) {
      const parts = signature.split(',').reduce((acc, part) => {
        const [key, value] = part.split('=');
        acc[key] = value;
        return acc;
      }, {});

      const timestamp = parts['t'];
      const expectedSig = parts['v1'];
      const signedPayload = `${timestamp}.${payload}`;

      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
      const computedSig = Array.from(new Uint8Array(sig))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Timing-safe comparison
      if (computedSig.length !== expectedSig.length) return false;
      let result = 0;
      for (let i = 0; i < computedSig.length; i++) {
        result |= computedSig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
      }
      return result === 0;
    }
    ```
  - Handle the following events:
    - `checkout.session.completed` -- Activate subscription, store `stripe_customer_id` and `stripe_subscription_id`
    - `customer.subscription.updated` -- Handle plan changes, status changes (active, past_due, canceled)
    - `customer.subscription.deleted` -- Downgrade user to Free tier
    - `invoice.payment_succeeded` -- Confirm subscription renewal, reset billing-period usage counters
    - `invoice.payment_failed` -- Mark subscription as `past_due`, send notification, begin grace period

- [ ] **Store subscription status in user database (D1 or KV on Cloudflare)**
  - Option A -- Cloudflare KV (simpler, use for MVP):
    ```toml
    # wrangler.toml
    [[kv_namespaces]]
    binding = "SUBSCRIPTIONS"
    id = "your-kv-namespace-id"
    ```
    ```js
    // Key: user:{userId}:subscription
    // Value:
    {
      "tier": "pro",               // "free" | "pro" | "team"
      "status": "active",          // "active" | "past_due" | "canceled" | "expired"
      "stripe_customer_id": "cus_XXX",
      "stripe_subscription_id": "sub_XXX",
      "revenuecat_app_user_id": null,
      "current_period_end": 1700000000,
      "cancel_at_period_end": false,
      "ai_requests_used": 42,
      "ai_requests_reset_at": 1700000000,
      "document_count": 3,
      "updated_at": 1700000000
    }
    ```
  - Option B -- Cloudflare D1 (relational, better for complex queries):
    ```sql
    CREATE TABLE subscriptions (
      user_id TEXT PRIMARY KEY,
      tier TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      revenuecat_app_user_id TEXT,
      current_period_end INTEGER,
      cancel_at_period_end INTEGER DEFAULT 0,
      ai_requests_used INTEGER DEFAULT 0,
      ai_requests_reset_at INTEGER,
      document_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX idx_stripe_customer ON subscriptions(stripe_customer_id);
    CREATE INDEX idx_revenuecat_user ON subscriptions(revenuecat_app_user_id);
    ```

- [ ] **Create customer portal endpoint for subscription management**
  - Add `POST /create-portal-session` route:
    ```js
    case '/create-portal-session': {
      const { customerId } = await request.json();
      const session = await stripeRequest('/billing_portal/sessions', 'POST', {
        customer: customerId,
        return_url: 'https://writer.app/settings',
      }, env.STRIPE_SECRET_KEY);

      return new Response(JSON.stringify({ url: session.url }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    ```
  - Configure the portal in Stripe Dashboard: enable cancellation, plan switching, payment method update

- [ ] **Add subscription status to JWT/auth token claims**
  - When generating auth tokens, include subscription data:
    ```js
    const tokenPayload = {
      sub: userId,
      email: userEmail,
      tier: subscription.tier,        // "free" | "pro" | "team"
      tier_status: subscription.status, // "active" | "past_due"
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    ```
  - NOTE: User authentication is now implemented (see cloudflare-workers/auth/worker.js and AUTH_DOCS.md).
    JWT-based auth with email/password is live. Subscription tier claims can be added
    to existing JWT tokens during the monetization phase.

- [ ] **Implement middleware to check subscription tier on protected routes**
  - Create a `checkTier` helper used before processing requests:
    ```js
    async function checkTier(request, env, requiredTier) {
      const userId = getUserIdFromRequest(request); // extract from JWT
      const sub = await env.SUBSCRIPTIONS.get(`user:${userId}:subscription`, { type: 'json' });

      if (!sub) return { allowed: false, tier: 'free' };

      const tierRank = { free: 0, pro: 1, team: 2 };
      const allowed = tierRank[sub.tier] >= tierRank[requiredTier] && sub.status === 'active';

      return { allowed, tier: sub.tier, subscription: sub };
    }
    ```
  - Apply to routes: `/chat/completions`, `/search-image`, `/generate-image`

- [ ] **Test with Stripe test mode and test clocks**
  - Use Stripe CLI for local webhook testing:
    ```bash
    stripe listen --forward-to https://writer-app-proxy.YOUR_SUBDOMAIN.workers.dev/stripe-webhook
    ```
  - Create test clocks in Stripe Dashboard to simulate subscription lifecycle:
    - New subscription -> renewal -> payment failure -> retry -> cancellation
  - Use Stripe test card numbers:
    - Success: `4242 4242 4242 4242`
    - Decline: `4000 0000 0000 0002`
    - Requires auth: `4000 0025 0000 3155`

- [ ] **Implement graceful downgrade flow (what happens when Pro user cancels)**
  - On `customer.subscription.updated` with `cancel_at_period_end: true`:
    - Set `cancel_at_period_end` in subscription store
    - User retains access until `current_period_end`
  - On `customer.subscription.deleted` (period ends):
    - Set tier to `free`, status to `expired`
    - Do NOT delete user documents; make excess documents read-only
    - Show banner in app: "Your Pro subscription has ended. Upgrade to edit all documents."
  - If user has more documents than free tier allows:
    - Mark documents beyond the limit as read-only (sorted by `updatedAt`, most recent remain editable)

- [ ] **Handle payment failure retry logic**
  - On `invoice.payment_failed`:
    - Set subscription status to `past_due`
    - Allow a grace period (e.g., 7 days) where features remain active
    - Show in-app banner: "Payment failed. Update your payment method to keep Pro features."
    - After grace period, downgrade to free tier
  - Stripe handles automatic retries (Smart Retries). Configure retry schedule in Dashboard under Billing > Subscriptions > Smart Retries.

---

## RevenueCat Integration (iOS In-App Purchases)

### Account & Project Setup

- [ ] **Create RevenueCat account and project**
  - Sign up at https://app.revenuecat.com
  - Create a new project named "Writer"
  - Note the RevenueCat Public API Key for Apple (`appl_XXXXX`)

- [ ] **Configure App Store Connect products (monthly/annual subscriptions)**
  - In App Store Connect, go to your app > Subscriptions
  - Create a Subscription Group: "Writer Premium"
  - Create subscription products:
    - `writer_pro_monthly` -- Writer Pro Monthly ($5.00/month)
    - `writer_pro_annual` -- Writer Pro Annual ($48.00/year)
    - `writer_team_monthly` -- Writer Team Monthly ($12.00/month)
    - `writer_team_annual` -- Writer Team Annual ($115.20/year)
  - Set up subscription pricing and localization
  - Create a Shared Secret in App Store Connect (App > General > App-Specific Shared Secret)
  - Enter this Shared Secret in RevenueCat Dashboard > Project > Apple App Store configuration

- [ ] **Install react-native-purchases (RevenueCat SDK) in the Expo app**
  - Install the package:
    ```bash
    npx expo install react-native-purchases
    ```
  - Add the config plugin to `app.json`:
    ```json
    {
      "expo": {
        "plugins": [
          "react-native-purchases"
        ]
      }
    }
    ```
  - This requires a development build (not Expo Go):
    ```bash
    npx expo prebuild
    eas build --platform ios --profile development
    ```

- [ ] **Configure RevenueCat with Apple API key**
  - Initialize in the app entry point. Add to `app/_layout.tsx`:
    ```tsx
    import Purchases from 'react-native-purchases';
    import { Platform } from 'react-native';

    useEffect(() => {
      const initPurchases = async () => {
        if (Platform.OS === 'ios') {
          Purchases.configure({
            apiKey: 'appl_YOUR_REVENUECAT_KEY',
            appUserID: userId, // from your auth system, or null for anonymous
          });
        }
      };
      initPurchases();
    }, []);
    ```

- [ ] **Create Offerings and Packages in RevenueCat dashboard**
  - In RevenueCat Dashboard > Offerings:
    - Create "default" offering
    - Create packages:
      - `$rc_monthly` -> `writer_pro_monthly` (App Store product)
      - `$rc_annual` -> `writer_pro_annual`
    - Optionally create a "team" offering with Team-tier packages
  - This mapping lets you change pricing/products server-side without app updates

### App Purchase Flow

- [ ] **Implement purchase flow in the app (show paywall, handle purchase, restore purchases)**
  - Create `components/Paywall.tsx`:
    ```tsx
    import React, { useEffect, useState } from 'react';
    import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
    import Purchases, { PurchasesOffering } from 'react-native-purchases';

    export function Paywall({ onClose }: { onClose: () => void }) {
      const [offering, setOffering] = useState<PurchasesOffering | null>(null);
      const [loading, setLoading] = useState(true);
      const [purchasing, setPurchasing] = useState(false);

      useEffect(() => {
        async function fetchOfferings() {
          try {
            const offerings = await Purchases.getOfferings();
            setOffering(offerings.current);
          } catch (e) {
            console.error('Failed to fetch offerings', e);
          } finally {
            setLoading(false);
          }
        }
        fetchOfferings();
      }, []);

      const handlePurchase = async (pkg: any) => {
        setPurchasing(true);
        try {
          const { customerInfo } = await Purchases.purchasePackage(pkg);
          if (customerInfo.entitlements.active['pro']) {
            Alert.alert('Success', 'You are now a Pro user!');
            onClose();
          }
        } catch (e: any) {
          if (!e.userCancelled) {
            Alert.alert('Error', 'Purchase failed. Please try again.');
          }
        } finally {
          setPurchasing(false);
        }
      };

      const handleRestore = async () => {
        try {
          const customerInfo = await Purchases.restorePurchases();
          if (customerInfo.entitlements.active['pro']) {
            Alert.alert('Restored', 'Your Pro subscription has been restored.');
            onClose();
          } else {
            Alert.alert('No Subscription', 'No active subscription found.');
          }
        } catch (e) {
          Alert.alert('Error', 'Could not restore purchases.');
        }
      };

      if (loading) return <ActivityIndicator />;

      return (
        <View>
          {offering?.availablePackages.map((pkg) => (
            <TouchableOpacity
              key={pkg.identifier}
              onPress={() => handlePurchase(pkg)}
              disabled={purchasing}
            >
              <Text>{pkg.product.title}</Text>
              <Text>{pkg.product.priceString}/
                {pkg.packageType === 'MONTHLY' ? 'month' : 'year'}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={handleRestore}>
            <Text>Restore Purchases</Text>
          </TouchableOpacity>
        </View>
      );
    }
    ```

- [ ] **Set up RevenueCat webhooks to sync with backend**
  - In RevenueCat Dashboard > Project > Integrations > Webhooks:
    - URL: `https://writer-app-proxy.YOUR_SUBDOMAIN.workers.dev/revenuecat-webhook`
    - Authorization Header: a shared secret for verification
  - Add `POST /revenuecat-webhook` route in `backend/worker.js`:
    ```js
    case '/revenuecat-webhook': {
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${env.REVENUECAT_WEBHOOK_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
      }

      const event = await request.json();
      const appUserId = event.event?.app_user_id;
      const eventType = event.event?.type;

      // Event types to handle:
      // INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION,
      // BILLING_ISSUE, PRODUCT_CHANGE, SUBSCRIBER_ALIAS
      switch (eventType) {
        case 'INITIAL_PURCHASE':
        case 'RENEWAL':
          await updateSubscription(env, appUserId, {
            tier: mapProductToTier(event.event.product_id),
            status: 'active',
            current_period_end: new Date(event.event.expiration_at_ms).getTime() / 1000,
          });
          break;
        case 'CANCELLATION':
        case 'EXPIRATION':
          await updateSubscription(env, appUserId, {
            tier: 'free',
            status: 'expired',
          });
          break;
        case 'BILLING_ISSUE':
          await updateSubscription(env, appUserId, {
            status: 'past_due',
          });
          break;
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    ```
  - Store `REVENUECAT_WEBHOOK_SECRET` as a Wrangler secret:
    ```bash
    npx wrangler secret put REVENUECAT_WEBHOOK_SECRET
    ```

- [ ] **Handle subscription status checking in the app**
  - Create `hooks/useSubscription.ts`:
    ```tsx
    import { useState, useEffect, useCallback } from 'react';
    import { Platform } from 'react-native';
    import Purchases, { CustomerInfo } from 'react-native-purchases';

    type Tier = 'free' | 'pro' | 'team';

    export function useSubscription() {
      const [tier, setTier] = useState<Tier>('free');
      const [loading, setLoading] = useState(true);

      const checkStatus = useCallback(async () => {
        try {
          if (Platform.OS === 'ios') {
            const customerInfo = await Purchases.getCustomerInfo();
            if (customerInfo.entitlements.active['team']) {
              setTier('team');
            } else if (customerInfo.entitlements.active['pro']) {
              setTier('pro');
            } else {
              setTier('free');
            }
          } else {
            // On web, check backend API
            const response = await fetch('/api/subscription-status');
            const data = await response.json();
            setTier(data.tier);
          }
        } catch (e) {
          console.error('Failed to check subscription', e);
          setTier('free');
        } finally {
          setLoading(false);
        }
      }, []);

      useEffect(() => {
        checkStatus();
      }, [checkStatus]);

      return { tier, loading, refresh: checkStatus, isPro: tier !== 'free' };
    }
    ```

- [ ] **Implement receipt validation**
  - RevenueCat handles receipt validation automatically when using their SDK
  - For additional server-side verification, query RevenueCat's REST API:
    ```js
    // GET https://api.revenuecat.com/v1/subscribers/{app_user_id}
    async function getRevenueCatSubscriber(appUserId, apiKey) {
      const response = await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.json();
    }
    ```
  - Store `REVENUECAT_API_KEY` (secret API key, NOT the public SDK key) as a Wrangler secret

- [ ] **Support family sharing and promotional offers**
  - Family Sharing:
    - Enable in App Store Connect under each subscription product
    - RevenueCat automatically handles family sharing entitlements
    - Test by adding a Family Sharing member in sandbox
  - Promotional Offers:
    - Create promotional offers in App Store Connect
    - Generate signature server-side for offer redemption:
      ```js
      // Backend endpoint: POST /generate-promo-offer-signature
      // Requires Apple Subscription Key (p8 file)
      // See: https://developer.apple.com/documentation/storekit/in-app_purchase/original_api_for_in-app_purchase/subscriptions_and_offers/generating_a_signature_for_promotional_offers
      ```
    - Use `Purchases.purchasePackage(pkg, null, null, promoOffer)` in the app

- [ ] **Test with sandbox environment**
  - Create Sandbox Apple ID in App Store Connect > Users and Access > Sandbox Testers
  - Sign out of production Apple ID on test device (Settings > App Store)
  - Sign in with sandbox account when prompted during purchase
  - Sandbox accelerates subscription renewal (1 month = 5 minutes)
  - Test the following flows:
    - New subscription purchase
    - Subscription renewal (wait 5 min in sandbox)
    - Cancellation (Settings > Apple ID > Subscriptions on device)
    - Restore purchases on a fresh install
    - Interrupted purchase (dismiss payment sheet mid-flow)

---

## Cross-Platform Subscription Sync

- [ ] **Design subscription status schema in backend database**
  - The central source of truth for subscription status lives in Cloudflare KV or D1 (as defined in Stripe section above)
  - Key design principle: one user account can have AT MOST one active subscription source (Stripe OR RevenueCat, not both)
  - Schema includes both `stripe_subscription_id` and `revenuecat_app_user_id` fields
  - Add a `subscription_source` field: `"stripe"` | `"revenuecat"` | `null`

- [ ] **Create unified subscription status API endpoint**
  - Add `GET /subscription-status` route in `backend/worker.js`:
    ```js
    case '/subscription-status': {
      const userId = getUserIdFromRequest(request);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const sub = await env.SUBSCRIPTIONS.get(`user:${userId}:subscription`, { type: 'json' });

      if (!sub) {
        return new Response(JSON.stringify({
          tier: 'free',
          status: 'active',
          document_limit: 5,
          ai_requests_limit: 10,
          ai_requests_used: 0,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const limits = {
        free: { documents: 5, ai_requests: 10 },
        pro: { documents: Infinity, ai_requests: 500 },
        team: { documents: Infinity, ai_requests: 2000 },
      };

      return new Response(JSON.stringify({
        tier: sub.tier,
        status: sub.status,
        current_period_end: sub.current_period_end,
        cancel_at_period_end: sub.cancel_at_period_end,
        document_limit: limits[sub.tier].documents,
        ai_requests_limit: limits[sub.tier].ai_requests,
        ai_requests_used: sub.ai_requests_used || 0,
        subscription_source: sub.subscription_source,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    ```

- [ ] **Map Stripe subscription IDs to RevenueCat subscriber IDs via user account**
  - When a user logs in on iOS after subscribing on web (or vice versa):
    1. App calls `GET /subscription-status` with auth token
    2. If subscription exists from Stripe, set RevenueCat app_user_id to the same `userId`
    3. Call `Purchases.logIn(userId)` on the iOS side to link RevenueCat to the same account
  - In RevenueCat Dashboard, use the same user ID as your backend `userId`
  - This ensures both platforms reference the same account

- [ ] **Implement webhook handlers that update central subscription store**
  - Both Stripe and RevenueCat webhooks write to the same KV/D1 store
  - Webhook handler pseudocode:
    ```js
    async function updateSubscription(env, userId, updates) {
      const key = `user:${userId}:subscription`;
      const existing = await env.SUBSCRIPTIONS.get(key, { type: 'json' }) || {};
      const updated = {
        ...existing,
        ...updates,
        updated_at: Math.floor(Date.now() / 1000),
      };
      await env.SUBSCRIPTIONS.put(key, JSON.stringify(updated));
    }
    ```

- [ ] **Add subscription status to auth token refresh flow**
  - When the app refreshes its auth token, include current subscription tier:
    1. App calls `POST /refresh-token`
    2. Backend looks up subscription from KV/D1
    3. Returns new JWT with updated tier claim
  - The app should cache the tier locally (AsyncStorage) and refresh on:
    - App foreground (from background)
    - After purchase flow completes
    - On auth token refresh

- [ ] **Handle edge cases: user subscribes on web, opens iOS app (and vice versa)**
  - Scenario A -- Subscribe on Web, open iOS app:
    1. App loads, calls `GET /subscription-status`
    2. Backend returns `tier: "pro"`, `subscription_source: "stripe"`
    3. App grants Pro features without requiring iOS purchase
    4. Paywall shows: "You have an active Pro subscription via web"
  - Scenario B -- Subscribe on iOS, open web:
    1. RevenueCat webhook already updated backend
    2. Web app calls `GET /subscription-status`, gets `tier: "pro"`
    3. Web grants Pro features
  - Scenario C -- User tries to subscribe on BOTH platforms:
    1. Backend checks if active subscription already exists
    2. If yes, return error: "You already have an active subscription on [other platform]"
    3. Show instructions to manage existing subscription

- [ ] **Prevent double-charging across platforms**
  - Before creating a Stripe checkout session, check if user already has an active RevenueCat subscription
  - Before completing a RevenueCat purchase, check backend for active Stripe subscription:
    ```tsx
    // In Paywall.tsx, before purchase:
    const status = await fetch('/subscription-status', { headers: authHeaders });
    const data = await status.json();
    if (data.tier !== 'free' && data.subscription_source !== 'revenuecat') {
      Alert.alert(
        'Active Subscription',
        'You already have a subscription via web. Manage it at writer.app/settings.'
      );
      return;
    }
    ```

- [ ] **Build subscription status cache layer**
  - Use Cloudflare KV with TTL for frequently accessed subscription data (KV reads are fast but writes have eventual consistency)
  - In the app, cache subscription status in AsyncStorage:
    ```tsx
    // utils/subscriptionCache.ts
    import AsyncStorage from '@react-native-async-storage/async-storage';

    const CACHE_KEY = 'subscription_cache';
    const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

    export async function getCachedSubscription() {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL_MS) {
          return data;
        }
      }
      return null;
    }

    export async function setCachedSubscription(data: any) {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    }
    ```
  - Invalidate cache on: purchase, restore, token refresh, app foreground

---

## Document Limit Enforcement

- [ ] **Add document count tracking per user**
  - Currently, documents are stored locally via AsyncStorage in `hooks/useNotes.ts`
  - For enforcing limits, the backend must know the document count. Two approaches:
    1. **(Simpler -- client-side enforcement):** Count documents in AsyncStorage and enforce locally. Less secure but works without backend document storage.
    2. **(Robust -- server-side enforcement):** Sync document count to backend on each create/delete. Store in subscription KV entry.
  - For client-side (MVP approach), add to `useNotes.ts`:
    ```tsx
    const getDocumentCount = useCallback(() => notes.length, [notes]);
    ```
  - For server-side, add a `POST /track-document-count` endpoint:
    ```js
    case '/track-document-count': {
      const userId = getUserIdFromRequest(request);
      const { count } = await request.json();
      await updateSubscription(env, userId, { document_count: count });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    ```

- [ ] **Implement document creation gate (check tier limits)**
  - Add gate logic before creating a new note in `hooks/useNotes.ts`:
    ```tsx
    const canCreateDocument = useCallback(async () => {
      const tier = await getCurrentTier(); // from useSubscription or cache
      const limits = { free: 5, pro: Infinity, team: Infinity };
      return notes.length < limits[tier];
    }, [notes]);
    ```
  - In the note creation handler (wherever new notes are triggered):
    ```tsx
    const handleNewNote = async () => {
      const allowed = await canCreateDocument();
      if (!allowed) {
        setShowUpgradePrompt(true);
        return;
      }
      // ... existing note creation logic
    };
    ```

- [ ] **Show upgrade prompt when free tier limit reached**
  - Create `components/UpgradePrompt.tsx`:
    ```tsx
    import React from 'react';
    import { View, Text, TouchableOpacity, Modal } from 'react-native';

    interface Props {
      visible: boolean;
      onClose: () => void;
      onUpgrade: () => void;
      feature: string; // "documents" | "ai"
    }

    export function UpgradePrompt({ visible, onClose, onUpgrade, feature }: Props) {
      const messages = {
        documents: "You've reached the free limit of 5 documents. Upgrade to Pro for unlimited documents.",
        ai: "You've used all your free AI requests today. Upgrade to Pro for 500 requests per day.",
      };

      return (
        <Modal visible={visible} transparent animationType="fade">
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, margin: 32 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 8 }}>
                Upgrade to Pro
              </Text>
              <Text style={{ fontSize: 16, color: '#666', marginBottom: 24 }}>
                {messages[feature]}
              </Text>
              <TouchableOpacity onPress={onUpgrade}
                style={{ backgroundColor: '#007AFF', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
                  View Plans
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={{ alignItems: 'center', padding: 8 }}>
                <Text style={{ color: '#666', fontSize: 14 }}>Not Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      );
    }
    ```

- [ ] **Handle graceful read-only mode for excess documents on downgrade**
  - When user downgrades from Pro to Free and has more than 5 documents:
    - Sort documents by `updatedAt` descending
    - The 5 most recently updated documents remain fully editable
    - All other documents become read-only
    - In the note editor (`app/note/[id].tsx`), check:
      ```tsx
      const isReadOnly = useMemo(() => {
        if (tier !== 'free') return false;
        const editableIds = notes
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, 5)
          .map(n => n.id);
        return !editableIds.includes(noteId);
      }, [tier, notes, noteId]);
      ```
    - Show a banner on read-only notes: "This document is read-only on the Free plan. Upgrade to edit."
    - Never delete user documents on downgrade

---

## AI Feature Gating

- [ ] **Add tier check before AI autocomplete requests to backend proxy**
  - Modify the `/chat/completions` handler in `backend/worker.js`:
    ```js
    case '/chat/completions':
    case '/v1/chat/completions': {
      const userId = getUserIdFromRequest(request);
      if (userId) {
        const sub = await env.SUBSCRIPTIONS.get(`user:${userId}:subscription`, { type: 'json' });
        const tier = sub?.tier || 'free';
        const limits = { free: 10, pro: 500, team: 2000 };
        const used = sub?.ai_requests_used || 0;

        if (used >= limits[tier]) {
          return new Response(JSON.stringify({
            error: 'AI request limit reached',
            limit: limits[tier],
            used: used,
            tier: tier,
            upgrade_url: 'https://writer.app/upgrade',
          }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Increment usage counter
        await updateSubscription(env, userId, {
          ai_requests_used: used + 1,
        });
      }
      return proxyToOpenRouter(request, env, '/chat/completions');
    }
    ```
  - NOTE: The auth worker now provides JWT-based authentication. Use `authenticateRequest()`
    from `cloudflare-workers/auth/auth-middleware.js` to extract user ID from JWT tokens.

- [ ] **Implement rate limiting per tier on the Cloudflare Worker**
  - Use Cloudflare KV with expiring keys for rate limiting:
    ```js
    async function checkRateLimit(env, identifier, limit, windowSeconds) {
      const key = `ratelimit:${identifier}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
      const current = parseInt(await env.SUBSCRIPTIONS.get(key) || '0');

      if (current >= limit) {
        return { allowed: false, remaining: 0, limit };
      }

      await env.SUBSCRIPTIONS.put(key, String(current + 1), {
        expirationTtl: windowSeconds * 2, // TTL slightly longer than window
      });

      return { allowed: true, remaining: limit - current - 1, limit };
    }
    ```
  - Apply before proxying AI requests:
    ```js
    const { allowed, remaining } = await checkRateLimit(
      env,
      userId || clientIP,
      limits[tier],
      86400 // 24 hour window
    );
    ```
  - Add rate limit headers to response:
    ```
    X-RateLimit-Limit: 500
    X-RateLimit-Remaining: 423
    X-RateLimit-Reset: 1700000000
    ```

- [ ] **Track AI usage per user per billing period**
  - Reset `ai_requests_used` counter:
    - On `invoice.payment_succeeded` Stripe webhook (new billing period)
    - On `RENEWAL` RevenueCat webhook
    - Also store `ai_requests_reset_at` timestamp
  - If using KV rate limiting with TTL (above), this is handled automatically
  - For more precise tracking, store daily usage:
    ```js
    const dailyKey = `usage:${userId}:${new Date().toISOString().split('T')[0]}`;
    ```

- [ ] **Show upgrade prompt when free AI limit reached**
  - In the app, handle the 429 response from the backend:
    ```tsx
    // In your AI request handler (wherever chat/completions is called)
    const response = await fetch(`${API_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(requestBody),
    });

    if (response.status === 429) {
      const data = await response.json();
      // Show upgrade prompt
      setUpgradePromptFeature('ai');
      setShowUpgradePrompt(true);
      return;
    }
    ```
  - Also gate the image search and generation features:
    ```tsx
    // Before calling /search-image or /generate-image
    if (tier === 'free') {
      setUpgradePromptFeature('ai');
      setShowUpgradePrompt(true);
      return;
    }
    ```

---

## Testing Checklist

### Stripe Testing

- [ ] **Test Stripe checkout flow end-to-end**
  - Use Stripe test mode keys
  - Complete checkout with test card `4242 4242 4242 4242`
  - Verify checkout session completed webhook fires
  - Verify subscription is stored in KV/D1
  - Verify `GET /subscription-status` returns correct tier

- [ ] **Test subscription renewal**
  - Use Stripe test clocks to advance time past billing period
  - Verify `invoice.payment_succeeded` webhook fires
  - Verify AI usage counter resets

- [ ] **Test cancellation and downgrade**
  - Cancel subscription via customer portal
  - Verify user retains access until period end
  - Advance test clock past period end
  - Verify `customer.subscription.deleted` fires
  - Verify user is downgraded to free tier
  - Verify excess documents become read-only

- [ ] **Test payment failure**
  - Use test card `4000 0000 0000 0341` (attaches but fails on charge)
  - Verify `invoice.payment_failed` fires
  - Verify grace period behavior
  - Verify Stripe Smart Retries trigger

### RevenueCat / iOS Testing

- [ ] **Test RevenueCat purchase flow on physical iOS device**
  - Must use a physical device (simulators cannot test IAP)
  - Sign in with sandbox Apple ID
  - Complete purchase flow
  - Verify entitlement is active in `Purchases.getCustomerInfo()`
  - Verify RevenueCat webhook fires and backend updates

- [ ] **Test restore purchases**
  - Delete and reinstall app
  - Tap "Restore Purchases"
  - Verify subscription is restored

- [ ] **Test subscription renewal (sandbox)**
  - Wait for sandbox renewal (5 min = 1 month)
  - Verify `RENEWAL` webhook fires
  - Verify continued access

- [ ] **Test cancellation (sandbox)**
  - Cancel via device Settings > Apple ID > Subscriptions
  - Verify access continues until period end
  - Verify `EXPIRATION` webhook fires after period
  - Verify downgrade to free tier

### Cross-Platform Testing

- [ ] **Test cross-platform sync (subscribe on web, verify on iOS)**
  - Subscribe via Stripe on web
  - Open iOS app, sign in with same account
  - Verify `GET /subscription-status` returns `tier: "pro"`
  - Verify Pro features are available without iOS purchase
  - Verify paywall shows "Active subscription via web"

- [ ] **Test cross-platform sync (subscribe on iOS, verify on web)**
  - Purchase via RevenueCat on iOS
  - Open web app, sign in with same account
  - Verify `GET /subscription-status` returns `tier: "pro"`

- [ ] **Test double-charge prevention**
  - Subscribe via Stripe
  - Attempt to purchase via RevenueCat on iOS
  - Verify warning message appears
  - Verify no double charge

### Infrastructure Testing

- [ ] **Test webhook reliability and retry logic**
  - Temporarily break webhook endpoint, then fix it
  - Verify Stripe retries failed webhooks (up to 3 days)
  - Verify RevenueCat retries failed webhooks
  - Verify no missed state changes after recovery
  - Test idempotency: send same webhook event twice, verify no duplicate processing

- [ ] **Load test payment endpoints**
  - Use a tool like `wrk` or `k6` to load test:
    - `GET /subscription-status` -- should handle 1000+ req/s (KV read)
    - `POST /chat/completions` with rate limiting -- verify limits enforced under load
  - Monitor Cloudflare Worker CPU time (must stay under 10ms for free plan, 30ms for paid)
  - Check KV read/write limits are not exceeded (100k reads/day on free plan)

---

## Prerequisites (status: COMPLETED)

> **[COMPLETED]** User authentication has been implemented. See `cloudflare-workers/auth/worker.js`,
> `services/auth.ts` (mobile), `desktop/src/services/auth.ts` (desktop), and `AUTH_DOCS.md`.

- [x] **Implement user authentication** (email/password via Cloudflare Workers)
  - Auth worker: `cloudflare-workers/auth/worker.js` (PBKDF2-SHA256, JWT)
  - Mobile: tokens stored in `expo-secure-store` (encrypted keychain)
  - Desktop: tokens stored in `localStorage`
  - Endpoints: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
  - Auth middleware: `cloudflare-workers/auth/auth-middleware.js` (reusable JWT validation)

- [x] **Add user account linking to notes**
  - Document sync API: `cloudflare-workers/document-sync/worker.js` (per-user R2 storage)
  - Client library: `utils/documentSync.js` (auto-save, conflict resolution)
  - Documents stored per-user in R2 at `documents/{user_id}/{document_id}.json`

---

## Environment Variables & Secrets Summary

| Variable | Storage | Description |
|---|---|---|
| `STRIPE_SECRET_KEY` | Wrangler secret | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Wrangler secret | Stripe webhook signing secret |
| `REVENUECAT_WEBHOOK_SECRET` | Wrangler secret | Shared secret for RevenueCat webhooks |
| `REVENUECAT_API_KEY` | Wrangler secret | RevenueCat secret API key (server-side) |
| `STRIPE_PRICE_PRO_MONTHLY` | wrangler.toml `[vars]` | Stripe Price ID for Pro monthly |
| `STRIPE_PRICE_PRO_ANNUAL` | wrangler.toml `[vars]` | Stripe Price ID for Pro annual |
| `STRIPE_PRICE_TEAM_MONTHLY` | wrangler.toml `[vars]` | Stripe Price ID for Team monthly |
| `STRIPE_PRICE_TEAM_ANNUAL` | wrangler.toml `[vars]` | Stripe Price ID for Team annual |

```bash
# Set all secrets at once:
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put REVENUECAT_WEBHOOK_SECRET
npx wrangler secret put REVENUECAT_API_KEY
```
