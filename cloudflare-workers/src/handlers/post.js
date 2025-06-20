/**
 * Handle POST requests routing
 */

import { getCorsHeaders } from '../utils/cors.js';
import { handleCreateMessage } from './messages/create.js';
import { handleViewMessage } from './messages/view.js';
import { handleUpdateOwner } from './messages/update.js';
import { handleListSecrets } from './messages/list.js';
import { handleListPendingSecrets } from './messages/pending.js';
import { handleUpdateCustomName } from './messages/customName.js';
import { handleDeleteSecret } from './messages/delete.js';

export async function handlePost(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  try {
    const body = await request.json();
    
    if (path === '/api/create') {
      return await handleCreateMessage(body, env, request);
    }
    
    if (path === '/api/view') {
      return await handleViewMessage(body, env, request);
    }
    
    if (path === '/api/update') {
      return await handleUpdateOwner(body, env, request);
    }
    
    if (path === '/api/list-secrets') {
      return await handleListSecrets(body, env, request);
    }
    
    if (path === '/api/list-pending-secrets') {
      return await handleListPendingSecrets(body, env, request);
    }
    
    if (path === '/api/update-custom-name') {
      return await handleUpdateCustomName(body, env, request);
    }
    
    if (path === '/api/delete-secret') {
      return await handleDeleteSecret(body, env, request);
    }
    
    return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
    
  } catch (error) {
    console.error('Error handling POST request:', error);
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
}