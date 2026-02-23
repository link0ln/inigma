/**
 * Handle message creation
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { generateRandomString } from '../../utils/crypto.js';
import { 
  getTimestamp, 
  isValidEncryptedData, 
  isValidIv, 
  isValidSalt, 
  isValidUid, 
  isValidCustomName, 
  isValidTtl,
  sanitizeString 
} from '../../utils/validation.js';
import { storeMessage } from '../../utils/database.js';
import { PERMANENT_TTL } from '../../constants/config.js';

export async function handleCreateMessage(body, env, request) {
  const { encrypted_message, iv, salt, ttl = 30, creator_uid, custom_name, idempotency_key } = body;

  // Idempotency check — return cached response for duplicate requests
  if (idempotency_key && typeof idempotency_key === 'string' && idempotency_key.length <= 64 && env.INIGMA_KV) {
    try {
      const cached = await env.INIGMA_KV.get(`idem:${idempotency_key}`, { type: 'json' });
      if (cached) {
        console.log(`Idempotent request: returning cached response for key ${idempotency_key.substring(0, 8)}...`);
        return new Response(JSON.stringify(cached), {
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(request),
          },
        });
      }
    } catch (e) {
      console.warn('Idempotency check failed, proceeding:', e.message);
    }
  }
  
  // Validate required fields
  if (!encrypted_message || !iv || !salt || !creator_uid) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }

  // Validate data format and size
  if (!isValidEncryptedData(encrypted_message)) {
    return new Response(JSON.stringify({ error: 'Invalid encrypted message format or size' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }

  if (!isValidIv(iv)) {
    return new Response(JSON.stringify({ error: 'Invalid IV format' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }

  if (!isValidSalt(salt)) {
    return new Response(JSON.stringify({ error: 'Invalid salt format' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }

  if (!isValidUid(creator_uid)) {
    return new Response(JSON.stringify({ error: 'Invalid creator UID format' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }

  if (!isValidTtl(ttl)) {
    return new Response(JSON.stringify({ error: 'Invalid TTL value' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }

  if (custom_name && !isValidCustomName(custom_name)) {
    return new Response(JSON.stringify({ error: 'Invalid custom name format or length' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }

  // Calculate TTL
  const currentTime = getTimestamp();
  const messageTtl = ttl === 0 ? PERMANENT_TTL : currentTime + (ttl * 24 * 60 * 60);
  
  // Validate that TTL is not in the past (for non-permanent messages)
  if (messageTtl !== PERMANENT_TTL && messageTtl <= currentTime) {
    return new Response(JSON.stringify({ error: 'Invalid TTL - cannot be in the past' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
  
  // Generate unique message ID
  const messageId = generateRandomString(25);
  
  // Create message data with sanitized inputs
  const messageData = {
    ttl: messageTtl,
    uid: '',
    encrypted_message,
    iv,
    salt,
    custom_name: custom_name ? sanitizeString(custom_name) : '',
    creator_uid,
  };
  
  // Store in D1
  const result = await storeMessage(env, messageId, messageData);

  if (!result.ok) {
    console.error(`Failed to store message for creator: ${creator_uid.substring(0, 8)}...`, result.error);
    return new Response(JSON.stringify({ error: 'Failed to store message' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
  
  console.log(`Message created successfully: ${messageId.substring(0, 8)}...`);
  const domain = env.DOMAIN || 'inigma.idone.su';

  const responseData = {
    url: `https://${domain}/`,
    view: messageId,
  };

  // Cache response for idempotency (1 hour TTL)
  if (idempotency_key && typeof idempotency_key === 'string' && idempotency_key.length <= 64 && env.INIGMA_KV) {
    try {
      await env.INIGMA_KV.put(`idem:${idempotency_key}`, JSON.stringify(responseData), { expirationTtl: 3600 });
    } catch (e) {
      console.warn('Failed to cache idempotency response:', e.message);
    }
  }

  return new Response(JSON.stringify(responseData), {
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(request),
    },
  });
}