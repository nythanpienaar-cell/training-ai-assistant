# Deploying for your team (Netlify)

Goal: your team opens one URL and uses the app. Nobody types a Groq key — the
key lives safely on the server, and the browser never sees it.

## How it works

- The app is static (HTML/CSS/JS). Netlify serves it.
- One small serverless function (`netlify/functions/groq.js`) holds your Groq
  key as an environment variable and forwards requests to Groq.
- The app auto-detects: opened from a real URL it uses the function (no key
  needed); opened straight from a file on your computer it falls back to the
  old "type your own key" mode for local testing.

## One-time setup (~10 minutes)

1. **Push this repo to GitHub** (already done if you're reading this on GitHub).

2. **Create a Netlify account** at https://netlify.com (free). Sign in with
   GitHub.

3. **Add the site:** Netlify dashboard → **Add new site → Import an existing
   project** → pick this GitHub repo. Netlify reads `netlify.toml`, so you can
   leave the build settings at their defaults. Click **Deploy**.

4. **Add your Groq key as a secret:** in the new site → **Site configuration →
   Environment variables → Add a variable**:
   - Key: `GROQ_API_KEY`
   - Value: your Groq key (`gsk_...`)
   - Save, then **Deploys → Trigger deploy → Deploy site** so the function picks
     it up.

5. **Share the URL** Netlify gives you (e.g. `your-site.netlify.app`). That's it
   — your team just opens it and generates manuals.

## Optional: lock it to your team with a password

By default anyone with the URL can use it (and spend your Groq credits). To gate
it behind a shared password:

1. Add a second environment variable in Netlify:
   - Key: `ACCESS_PASSWORD`
   - Value: any password you choose
   - Save and redeploy.
2. Tell your team the password. In the app, they open **⚙ settings** once and
   type it into the **Team password** field. It's remembered in their browser.

Leave `ACCESS_PASSWORD` unset to keep the proxy open.

## Rotating or changing the key

Update `GROQ_API_KEY` in Netlify's environment variables and trigger a redeploy.
No code change, and nothing to re-share with the team.

## Local testing (optional, for developers)

- **Quickest:** open `index.html` directly from disk — it uses "type your key"
  mode, so paste a Groq key into settings.
- **Full proxy locally:** install the Netlify CLI (`npm i -g netlify-cli`), put
  `GROQ_API_KEY=gsk_...` in a `.env` file, and run `netlify dev`. This serves
  the app and the function together at `http://localhost:8888`.
