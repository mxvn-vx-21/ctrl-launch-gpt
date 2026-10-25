import { json } from '../../_lib/util.js';
import { isConfigured } from '../../_lib/oauth.js';
export const onRequestGet = ({ env }) => json({ google: isConfigured(env, 'google'), github: isConfigured(env, 'github'), email: !!env.RESEND_API_KEY });
