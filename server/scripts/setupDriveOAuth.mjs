import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();

const PORT = 8085;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function updateEnvFile(key, value) {
  const envPath = path.resolve(process.cwd(), '.env');
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}`;
  }

  fs.writeFileSync(envPath, content, 'utf-8');
  console.log(`[Config] Saved ${key} to .env`);
}

async function main() {
  console.log('\n======================================================');
  console.log('   Google Drive Personal Account (@gmail.com) Setup   ');
  console.log('======================================================\n');

  let clientId = process.env.GOOGLE_CLIENT_ID;
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId) {
    clientId = await prompt('Enter your Google OAuth Client ID: ');
    if (clientId) updateEnvFile('GOOGLE_CLIENT_ID', clientId);
  } else {
    console.log('Using GOOGLE_CLIENT_ID from .env');
  }

  if (!clientSecret) {
    clientSecret = await prompt('Enter your Google OAuth Client Secret: ');
    if (clientSecret) updateEnvFile('GOOGLE_CLIENT_SECRET', clientSecret);
  } else {
    console.log('Using GOOGLE_CLIENT_SECRET from .env');
  }

  if (!clientId || !clientSecret) {
    console.error('Error: Both Client ID and Client Secret are required.');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive'],
  });

  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = url.parse(req.url, true);
      if (parsedUrl.pathname === '/oauth2callback') {
        const code = parsedUrl.query.code;
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Authorization failed: No code received.</h1>');
          return;
        }

        const { tokens } = await oauth2Client.getToken(code);
        if (tokens.refresh_token) {
          updateEnvFile('GOOGLE_REFRESH_TOKEN', tokens.refresh_token);
        } else {
          console.warn('[Warning] No refresh token returned.');
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #16a34a;">&#x2705; Google Drive Connected Successfully!</h1>
            <p style="font-size: 16px; color: #475569;">Your refresh token has been saved to <code>.env</code>.</p>
            <p style="font-size: 14px; color: #64748b;">You can now close this tab and return to your terminal.</p>
          </div>
        `);

        console.log('\n======================================================');
        console.log('  [SUCCESS] Google Drive Connected Successfully!');
        console.log('  Refresh Token saved to .env.');
        console.log('  Your project dashboard will now upload files using');
        console.log('  your personal Google Drive storage!');
        console.log('======================================================\n');

        server.close(() => {
          process.exit(0);
        });
      }
    } catch (err) {
      console.error('Error handling callback:', err);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<h1>Error: ${err.message}</h1>`);
    }
  });

  server.listen(PORT, () => {
    console.log(`\nWaiting for Google authentication on ${REDIRECT_URI} ...\n`);
    console.log('Opening your browser for authorization...');
    console.log('If browser does not open automatically, copy & paste this link into your browser:');
    console.log('\n' + authUrl + '\n');

    exec(`start "" "${authUrl.replace(/&/g, '^&')}"`);
  });
}

main().catch(console.error);