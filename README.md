# userp.ly

userp.ly is a Chrome extension that shows date context on Google search results before you click.

## Launch scope

- **Free:** Google date badges + Normal only
- **Pro:** Google date badges + Normal + Newest + Oldest
- **Normal** always restores Google's original ranking
- Invalid or expired licenses fall back to **Free**

## What it does

- Adds date-context badges to Google search results
- Verifies or estimates publish-date context before a click
- Preserves Google's original order in Normal mode
- Unlocks alternate sort modes for eligible Pro users

## Permissions

- `storage` for local extension settings and cached state
- `https://public-website-builder.replit.app/*` for license verification
- `https://nihquqccvnfuaqsxyymj.supabase.co/*` for date verification
- Google host matches for injecting badges on Google results pages

## Privacy summary

userp.ly stores local settings in the browser and sends result URLs to configured verification services only as needed to provide date verification and license checks.

Any published privacy policy should match the current launch scope:
- Google only
- no Bing or DuckDuckGo support
- no Safari or iOS references
- no App Store, TestFlight, or RevenueCat references

## Development notes

This repository currently targets the Google-only launch scope. Do not broaden search-engine support or modify backend, Stripe, payment links, or Replit endpoints unless explicitly requested.
