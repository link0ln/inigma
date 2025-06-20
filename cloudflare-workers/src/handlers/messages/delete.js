/**
 * Handle deleting a secret
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { isValidMessageId, isValidUid } from '../../utils/validation.js';
import { deleteMessage } from '../../utils/database.js';

export async function handleDeleteSecret(body, env, request) {
  const { view, uid } = body;
  
  if (!view || !isValidMessageId(view)) {
    return new Response(JSON.stringify({
      status: 'failed',
      message: 'Invalid view parameter',
    }), {
      status: 400,
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
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
  
  try {
    // Delete using D1 (handles access control internally)
    const success = await deleteMessage(env, view, uid);
    
    if (!success) {
      return new Response(JSON.stringify({
        status: 'failed',
        message: 'Secret not found or access denied',
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request),
        },
      });
    }
    
    return new Response(JSON.stringify({
      status: 'success',
      message: 'Secret deleted',
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
    
  } catch (error) {
    console.error('Error deleting secret:', error);
    return new Response(JSON.stringify({
      status: 'failed',
      message: 'Failed to delete secret',
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
}