/**
 * Handle updating custom name
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { isValidMessageId, isValidUid, isValidCustomName, sanitizeString } from '../../utils/validation.js';
import { updateCustomName } from '../../utils/database.js';

export async function handleUpdateCustomName(body, env, request) {
  const { view, uid, custom_name } = body;
  
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

  if (custom_name === undefined) {
    return new Response(JSON.stringify({
      status: 'failed',
      message: 'Missing custom_name parameter',
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }

  if (!isValidCustomName(custom_name)) {
    return new Response(JSON.stringify({
      status: 'failed',
      message: 'Invalid custom name format or length',
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
  
  try {
    // Sanitize custom name
    const sanitizedName = sanitizeString(custom_name);
    
    // Update custom name using D1
    const success = await updateCustomName(env, view, uid, sanitizedName);
    
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
      message: 'Custom name updated',
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
    
  } catch (error) {
    console.error('Error updating custom name:', error);
    return new Response(JSON.stringify({
      status: 'failed',
      message: 'Failed to update name',
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
}