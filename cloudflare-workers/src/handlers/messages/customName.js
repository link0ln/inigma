/**
 * Handle updating custom name
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { isValidMessageId } from '../../utils/validation.js';
import { retrieveMessage, storeMessage } from '../../utils/storage.js';

export async function handleUpdateCustomName(body, env, request) {
  const { view, uid, custom_name } = body;
  
  if (!view || !isValidMessageId(view) || !uid || custom_name === undefined) {
    return new Response(JSON.stringify({
      status: 'failed',
      message: 'Missing required parameters',
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
  
  try {
    // Retrieve current data
    const data = await retrieveMessage(env, view);
    
    if (!data) {
      return new Response(JSON.stringify({
        status: 'failed',
        message: 'Secret not found',
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request),
        },
      });
    }
    
    // Check if user owns this secret
    if (data.uid !== uid) {
      return new Response(JSON.stringify({
        status: 'failed',
        message: 'Access denied',
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request),
        },
      });
    }
    
    // Update custom name
    data.custom_name = custom_name;
    
    // Save updated data
    const success = await storeMessage(env, view, data);
    
    if (!success) {
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