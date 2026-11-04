# EDITVAULT

EDITVAULT is a free, multi-page resource discovery website for video editors. It helps editors search across supported resource providers instead of jumping between many websites.

## Phase 1: Website foundation

This version focuses on the website experience:
- Separate pages for Music, Sound Effects, Images, GIFs, Overlays, LUTs, Templates, Fonts and Saved resources.
- Responsive layout for phones, tablets and desktop.
- Shared navigation across all pages.
- Dark/light theme switcher with saved preference.
- Search interface connected to the Node API when the backend is hosted.
- Saved resources stored locally in the current browser for this first phase.
- Clear license notices and links to original provider pages.
- GitHub Actions workflow that publishes only the `public/` folder to GitHub Pages.

**Authentication is intentionally not connected in this phase.** Supabase login and private cloud-synced saved resources will be added after the website layout and navigation are approved.

## Run locally

Requires Node.js 18 or newer.

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000`.

## Search providers

The backend can query these providers when their API credentials are configured:

- Pexels — photos and videos
- Pixabay — photos and videos
- GIPHY — GIFs
- Freesound — sound effects
- Jamendo — music

Add provider keys to the server's `.env` file or your Node hosting provider's environment settings. Do not put private provider keys in frontend JavaScript.

Overlays, LUTs, templates and fonts currently open curated provider searches. EDITVAULT does not scrape sites, bypass access controls, or mirror files without permission.

## GitHub Pages

The included workflow publishes the contents of `public/`. In GitHub, open **Settings → Pages** and select **GitHub Actions** as the source.

GitHub Pages hosts the frontend only. The search API requires the Node backend to be deployed separately to a Node-compatible host. Until that backend is deployed and configured, the website layout works but live provider search will show a clear connection message.

## Saved resources in Phase 1

Saved resources are stored in browser localStorage on the current device. They are not yet synced between devices or protected by an account. Supabase authentication and private database sync are planned for Phase 2.

## Licensing and privacy

- A download link does not automatically grant permission to reuse an asset.
- EDITVAULT shows the provider and license information returned by the provider where available.
- If a license cannot be verified, the interface warns that the asset may be copyrighted or restricted.
- Search terms are sent to the configured third-party providers through the backend. Their own privacy terms apply.
- EDITVAULT does not store search history in its own database.
