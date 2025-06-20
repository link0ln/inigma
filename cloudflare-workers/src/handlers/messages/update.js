/**
 * Handle owner update
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { isValidMessageId } from '../../utils/validation.js';
import { retrieveMessage, storeMessage } from '../../utils/storage.js';

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
  
  // Retrieve current data
  const data = await retrieveMessage(env, view);
  
  if (!data) {
    return new Response(JSON.stringify({
      status: 'failed',
      message: 'No such secret',
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
  
  // Check if already owned
  if (data.uid !== '') {
    return new Response(JSON.stringify({
      status: 'failed',
      message: 'Secret already owned',
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
  
  // Update data
  data.uid = uid;
  data.encrypted_message = encrypted_message;
  data.iv = iv;
  data.salt = salt;
  data.custom_name = data.custom_name || '';
  // Preserve creator_uid
  data.creator_uid = data.creator_uid || '';
  
  // Save updated data
  const success = await storeMessage(env, view, data);
  
  if (!success) {
    return new Response(JSON.stringify({
      status: 'failed',
      message: 'Failed to update message',
    }), {
      status: 500,
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