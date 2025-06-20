/**
 * Handle deleting a secret
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { isValidMessageId } from '../../utils/validation.js';
import { retrieveMessage, deleteMessage } from '../../utils/storage.js';

export async function handleDeleteSecret(body, env, request) {
  const { view, uid } = body;
  
  if (!view || !isValidMessageId(view) || !uid) {
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
    
    // Check if user owns this secret (owner) or created it (pending)
    if (data.uid !== '' && data.uid !== uid) {
      // Secret is owned by someone else
      return new Response(JSON.stringify({
        status: 'failed',
        message: 'Access denied',
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request),
        },
      });
    } else if (data.uid === '' && data.creator_uid !== uid) {
      // Secret is pending and user is not the creator
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
    
    // Delete the message
    const success = await deleteMessage(env, view);
    
    if (!success) {
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