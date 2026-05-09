// Usage: pnpm secrets:edit
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..'),TARGET=path.join(ROOT,'secrets.local.env');
const rand=b=>crypto.randomBytes(b).toString('base64');
let j=rand(48),jr=rand(48),g=rand(48),e=rand(64),s=rand(32),a=rand(32),r=rand(32);
if(fs.existsSync(TARGET)){
  const x=fs.readFileSync(TARGET,'utf8'),get=k=>{const m=x.match(new RegExp('^'+k+'=(.+)$','m'));return m?m[1].trim():''};
  j=get('LSP_JWT_SECRET')||j; jr=get('LSP_JWT_REFRESH_SECRET')||jr; g=get('LSP_GATEWAY_INTERNAL_SECRET')||g;
  e=get('LSP_ENCRYPTION_KEY')||e; s=get('LSP_SESSION_SECRET')||s; a=get('LSP_AUTH_SECRET')||a; r=get('LSP_REDIS_PASSWORD')||r;
  console.log('Found existing file - preserving crypto secrets.');
}else{console.log('Creating secrets.local.env...');}
const lines=[
'# secrets.local.env - edit all values, save, close, then run: pnpm secrets:push',
'# This file is in .gitignore and will NEVER be committed.',
'',
'# -- REQUIRED: GitHub PAT (same token stored as GHCR_TOKEN in GitHub Secrets) -',
'# Scripts use this to push/pull secrets without gh auth login.',
'GHCR_TOKEN=',
'GHCR_USERNAME=',
'# Optional override if you want a different token just for secrets management:',
'# GH_TOKEN=',
'',
'# -- AUTO-GENERATED crypto keys (do not edit unless rotating) ----------------',
'LSP_JWT_SECRET='+j,
'LSP_JWT_REFRESH_SECRET='+jr,
'LSP_GATEWAY_INTERNAL_SECRET='+g,
'LSP_ENCRYPTION_KEY='+e,
'LSP_SESSION_SECRET='+s,
'LSP_AUTH_SECRET='+a,
'LSP_REDIS_PASSWORD='+r,
'',
'# -- REQUIRED: Database password ---------------------------------------------',
'LSP_POSTGRES_PASSWORD=',
'# -- REQUIRED: Super admin email ---------------------------------------------',
'LSP_SUPER_ADMIN_EMAIL=',
'# -- REQUIRED: Super admin password (min 12 chars) ---------------------------',
'LSP_SUPER_ADMIN_PASSWORD=',
'LSP_SUPER_ADMIN_NAME=Super Admin',
'# -- REQUIRED: API domain ----------------------------------------------------',
'LSP_API_DOMAIN=lsp-api.easydev.in',
'# -- REQUIRED: Frontend domain -----------------------------------------------',
'LSP_FRONTEND_DOMAIN=lsp.easydev.in',
'# -- REQUIRED: File upload service URL ----------------------------------------',
'LSP_FILE_UPLOAD_SERVICE_URL=https://your-upload-service.onrender.com',
'',
'# -- OPTIONAL: Second admin (blank to skip) -----------------------------------',
'LSP_ADMIN_EMAIL=','LSP_ADMIN_PASSWORD=','LSP_ADMIN_NAME=Admin',
'',
'# -- OPTIONAL: CORS (blank = auto from LSP_FRONTEND_DOMAIN) ------------------',
'# Example: https://lsp.easydev.in,https://www.lsp.easydev.in',
'LSP_CORS_ORIGINS=',
'',
'# -- OPTIONAL: DB config ------------------------------------------------------',
'LSP_POSTGRES_USER=postgres','LSP_POSTGRES_DB=marketplace',
'',
'# -- OPTIONAL: App metadata ---------------------------------------------------',
'LSP_NOTIFICATION_FROM_NAME=Local Service Marketplace',
'LSP_DEFAULT_TENANT_ID=local-service-marketplace',
'',
'# -- OPTIONAL: Notification ---------------------------------------------------',
'LSP_NOTIFICATION_SERVICE_URL=','LSP_NOTIFICATION_FROM_EMAIL=noreply@easydev.in','LSP_NOTIFICATION_API_KEY=',
'',
'# -- OPTIONAL: Payment (mock | razorpay | stripe) -----------------------------',
'LSP_PAYMENT_GATEWAY=mock','LSP_RAZORPAY_KEY_ID=','LSP_RAZORPAY_KEY_SECRET=','LSP_RAZORPAY_WEBHOOK_SECRET=',
'LSP_STRIPE_SECRET_KEY=','LSP_STRIPE_WEBHOOK_SECRET=',
'',
'# -- OPTIONAL: OAuth ----------------------------------------------------------',
'LSP_GOOGLE_CLIENT_ID=','LSP_GOOGLE_CLIENT_SECRET=',
'LSP_FACEBOOK_APP_ID=','LSP_FACEBOOK_APP_SECRET=',
'LSP_GOOGLE_MAPS_API_KEY=',
];
fs.writeFileSync(TARGET,lines.join('\n'),{encoding:'utf8',mode:0o600});
console.log('\nOpening: '+TARGET);
const w=process.platform==='win32';
if(w)spawnSync('notepad.exe',[TARGET],{stdio:'inherit'});
else if(process.platform==='darwin')spawnSync('open',['-t',TARGET],{stdio:'inherit'});
else spawnSync(process.env.EDITOR||'nano',[TARGET],{stdio:'inherit'});
console.log('\nDone. Now run: pnpm secrets:push');
