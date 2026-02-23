/**
 * Handle owner update
 */

import { getCorsHeaders } from '../../utils/cors.js';
import {
  isValidMessageId,
  isValidUid,
  isValidEncryptedData,
  isValidIv,
  isValidSalt
} from '../../utils/validation.js';
import { updateMessageOwner } from '../../utils/database.js';

export async function handleUpdateOwner(body, env, request) {
  const { view, uid, encrypted_message, iv, salt } = body;
  
  if (!view || !isValidMessageId(view)) {
    return new Response(JSON.stringify({
      status: 'failed',
      message: 'Invalid view parameter',
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }

  if (!uid || !isValidUid(uid)) {
    return new Response(JSON.stringify({
      status: 'failed',
      message: 'Invalid UID format',
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }

  if (!encrypted_message || !isValidEncryptedData(encrypted_message)) {
    return new Response(JSON.stringify({
      status: 'failed',
      message: 'Invalid encrypted message format',
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }

  if (!iv || !isValidIv(iv)) {
    return new Response(JSON.stringify({
      status: 'failed',
      message: 'Invalid IV format',
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }

  if (!salt || !isValidSalt(salt)) {
    return new Response(JSON.stringify({
      status: 'failed',
      message: 'Invalid salt format',
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
  
  // Atomically update owner — SQL WHERE uid = '' prevents race conditions
  const result = await updateMessageOwner(env, view, uid, encrypted_message, iv, salt);

  if (!result.ok) {
    const statusMap = { not_found: 404, already_owned: 409, db_error: 503 };
    const messageMap = { not_found: 'Secret not found', already_owned: 'Secret already owned', db_error: 'Service temporarily unavailable' };
    return new Response(JSON.stringify({
      status: 'failed',
      message: messageMap[result.error] || 'Secret not found or already owned',
    }), {
      status: statusMap[result.error] || 404,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
  
  return new Response(JSON.stringify({
    status: 'success',
    message: 'secret owned',
  }), {
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(request),
    },
  });
}