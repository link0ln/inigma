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
  const success = await updateMessageOwner(env, view, uid, encrypted_message, iv, salt);

  if (!success) {
    return new Response(JSON.stringify({
      status: 'failed',
      message: 'Secret not found or already owned',
    }), {
      status: 404,
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