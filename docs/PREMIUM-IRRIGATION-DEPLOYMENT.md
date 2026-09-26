# Premium irrigation planner deployment

The planner HTML is stored under `supabase/private-assets/`, outside the
Next.js `public/` tree. The static page requests the HTML from the
`premium-irrigation-planner` Supabase Edge Function. The JWT gateway and the
function validate the caller's session; the function also checks active Premium
before reading the private `premium-tools` bucket. Supabase Storage deliberately
serves HTML as plain text. The function checks the downloaded bytes against the
versioned SHA-256 in `load-trusted-planner.mjs` and returns the trusted document
to the page. The page runs it in an opaque-origin `allow-scripts` sandbox with a
bounded, nonce-checked storage bridge.

Apply the migrations and deploy the function with the Supabase CLI:

```sh
supabase db push
supabase functions deploy premium-irrigation-planner --use-api
```

Upload or update the private asset from a trusted administrator shell. Never
put the service-role key in a `NEXT_PUBLIC_*` variable, browser code, or a
committed environment file.

PowerShell:

```powershell
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"
pnpm exec node scripts/upload-premium-irrigation-planner.mjs
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
Remove-Item Env:SUPABASE_URL
```

The upload is intentionally separate from the public Pages build: the
service-role key must not be added to the GitHub Pages build environment.
Keep the function's JWT gateway verification enabled. Its only route is POST;
the iframe never calls the function directly. The function also checks the
session with `auth.getUser()` and verifies active Premium before serving bytes.
After the migration, function, and private asset are deployed, the public
`/tools/irrigation-planner/index.html` URL no longer exists. When updating the
private HTML, compute its SHA-256 and update `load-trusted-planner.mjs` in the
same change; a mismatch fails closed rather than running unreviewed HTML.

The migration resets inactive guild applications to the default `member` role.
It leaves active officer assignments intact because the database cannot tell a
legitimate promotion from a role written through the old vulnerable policy.
Review active officers after applying the migration and correct any unexpected
assignments through the guild-master role controls.

On load, the page copies its known planner storage keys into the sandbox's
in-memory store. The sandbox sends changes back through `postMessage`; the page
requires the exact iframe window, opaque origin, and a per-load nonce. Full
screen expands that same sandboxed iframe.

This controls normal access through the hosted site. The repository itself is
public, so its checked-in planner source can still be read or copied. Protecting
the source or calculation value from repository readers would require a private
source repository or moving the valuable calculation and data to the server.
