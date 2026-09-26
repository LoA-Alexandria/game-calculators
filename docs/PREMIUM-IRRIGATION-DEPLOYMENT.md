# Premium irrigation planner deployment

The planner HTML is stored under `supabase/private-assets/`, outside the
Next.js `public/` tree. The static page requests a short-lived signed URL from
the `premium-irrigation-planner` Supabase Edge Function. That function validates
the caller's Supabase session and active Premium entitlement before signing a
read from the private `premium-tools` bucket.

Apply the migrations and deploy the function with the Supabase CLI:

```sh
supabase db push
supabase functions deploy premium-irrigation-planner
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
After the migration, function, and private asset are deployed, the public
`/tools/irrigation-planner/index.html` URL no longer exists. Signed URLs expire
after ten minutes; refresh the planner page to obtain another URL.

The migration resets inactive guild applications to the default `member` role.
It leaves active officer assignments intact because the database cannot tell a
legitimate promotion from a role written through the old vulnerable policy.
Review active officers after applying the migration and correct any unexpected
assignments through the guild-master role controls.

On its first load, the planner imports its previous layout, settings, and color
scheme from the site origin through a whitelisted `postMessage` handshake. The
planner accepts that bootstrap only from the production site or local dev
origins, and only for its known storage keys.

This controls normal access through the hosted site. The repository itself is
public, so its checked-in planner source can still be read or copied. Protecting
the source or calculation value from repository readers would require a private
source repository or moving the valuable calculation and data to the server.
