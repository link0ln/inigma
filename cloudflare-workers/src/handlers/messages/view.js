/**
 * Handle message viewing
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { isValidMessageId, getTimestamp } from '../../utils/validation.js';
import { retrieveMessage, deleteMessage } from '../../utils/storage.js';

export async function handleViewMessage(body, env, request) {
  const { view, uid } = body;
  
  if (!view || !isValidMessageId(view)) {
    return new Response(JSON.stringify({
      message: 'Invalid view parameter',
      redirect_root: 'true',
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
  
  // Retrieve message data
  const data = await retrieveMessage(env, view);
  
  if (!data) {
    return new Response(JSON.stringify({
      message: 'No such hash!',
      redirect_root: 'true',
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
  
  // Check TTL
  const currentTime = getTimestamp();
  if (data.ttl < currentTime) {
    // Delete expired message
    await deleteMessage(env, view);
    return new Response(JSON.stringify({
      message: 'Message has expired!',
      redirect_root: 'true',
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
  
  // Check access permissions
  if (data.uid === '' || data.uid === uid) {
    // Create response with only necessary fields
    const responseData = {
      encrypted_message: data.encrypted_message,
      iv: data.iv,
      salt: data.salt,
      custom_name: data.custom_name || '',
      is_owner: data.uid === uid
    };
    
    return new Response(JSON.stringify(responseData), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
  
  return new Response(JSON.stringify({
    message: 'Access denied!',
    redirect_root: 'true',
  }), {
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(request),
    },
  });
}