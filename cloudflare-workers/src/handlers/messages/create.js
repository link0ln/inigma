/**
 * Handle message creation
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { generateRandomString } from '../../utils/crypto.js';
import { getTimestamp } from '../../utils/validation.js';
import { storeMessage } from '../../utils/storage.js';
import { PERMANENT_TTL } from '../../constants/config.js';

export async function handleCreateMessage(body, env, request) {
  const { encrypted_message, iv, salt, ttl = 30, creator_uid } = body;
  
  if (!encrypted_message || !iv || !salt || !creator_uid) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
  
  // Calculate TTL
  const messageTtl = ttl === 0 ? PERMANENT_TTL : getTimestamp() + (ttl * 24 * 60 * 60);
  
  // Generate unique message ID
  const messageId = generateRandomString(25);
  
  // Create message data
  const messageData = {
    ttl: messageTtl,
    uid: '',
    encrypted_message,
    iv,
    salt,
    custom_name: body.custom_name || '',
    creator_uid,
  };
  
  // Store in R2
  const success = await storeMessage(env, messageId, messageData);
  
  if (!success) {
    return new Response(JSON.stringify({ error: 'Failed to store message' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
  
  const domain = env.DOMAIN || 'inigma.idone.su';
  
  return new Response(JSON.stringify({
    url: `https://${domain}/`,
    view: messageId,
  }), {
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(request),
    },
  });
}