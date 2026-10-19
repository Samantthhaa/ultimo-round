import { readConfig } from '../src/config.js';
import {inviteUrl} from '../src/invite.js';
try {
  const { appId } = readConfig(process.env, { tokenRequired: false });
  console.log(inviteUrl(appId));
} catch (error) { console.error(error.message); process.exitCode = 1; }
