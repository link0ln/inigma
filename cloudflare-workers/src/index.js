/**
 * Inigma - Secure Message Sharing Service
 * Cloudflare Workers Implementation
 */

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://inigma.idone.su',  // Production domain
  'http://localhost:8000',    // Local development
  'http://127.0.0.1:8000',   // Alternative local
];

// Base CORS headers
const BASE_CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Get CORS headers with proper origin checking
 */
function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return {
      ...BASE_CORS_HEADERS,
      'Access-Control-Allow-Origin': origin,
    };
  }
  
  // Fallback for non-browser requests or allowed origins
  return {
    ...BASE_CORS_HEADERS,
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0], // Default to production
  };
}

/**
 * Generate cryptographically secure random string
 */
function generateRandomString(length = 25) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  const randomBytes = crypto.getRandomValues(new Uint8Array(length));
  
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  
  return result;
}

/**
 * Get current timestamp
 */
function getTimestamp() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Validate message ID format
 */
function isValidMessageId(id) {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * Store message data in R2
 */
async function storeMessage(env, messageId, data) {
  try {
    const jsonData = JSON.stringify(data);
    await env.INIGMA_STORAGE.put(messageId, jsonData, {
      httpMetadata: {
        contentType: 'application/json',
      },
    });
    return true;
  } catch (error) {
    console.error('Error storing message:', error);
    return false;
  }
}

/**
 * Retrieve message data from R2
 */
async function retrieveMessage(env, messageId) {
  try {
    const object = await env.INIGMA_STORAGE.get(messageId);
    if (!object) {
      return null;
    }
    const data = await object.json();
    return data;
  } catch (error) {
    console.error('Error retrieving message:', error);
    return null;
  }
}

/**
 * Delete message from R2
 */
async function deleteMessage(env, messageId) {
  try {
    await env.INIGMA_STORAGE.delete(messageId);
    return true;
  } catch (error) {
    console.error('Error deleting message:', error);
    return false;
  }
}

/**
 * Cleanup old messages
 */
async function cleanupOldMessages(env) {
  try {
    const cleanupDays = parseInt(env.CLEANUP_DAYS || '50');
    const cutoffTime = getTimestamp() - (cleanupDays * 24 * 60 * 60);
    
    // List all objects
    const list = await env.INIGMA_STORAGE.list();
    let deletedCount = 0;
    
    for (const object of list.objects) {
      try {
        const messageData = await retrieveMessage(env, object.key);
        if (messageData && messageData.ttl < cutoffTime) {
          await deleteMessage(env, object.key);
          deletedCount++;
        }
      } catch (error) {
        console.error(`Error processing message ${object.key}:`, error);
      }
    }
    
    console.log(`Cleanup completed. Deleted ${deletedCount} expired messages.`);
    return deletedCount;
  } catch (error) {
    console.error('Error during cleanup:', error);
    return 0;
  }
}

/**
 * Handle OPTIONS requests (CORS preflight)
 */
function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

/**
 * Handle GET requests
 */
async function handleGet(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  if (path === '/') {
    return new Response(indexHTML, {
      headers: {
        'Content-Type': 'text/html',
        ...getCorsHeaders(request),
      },
    });
  }
  
  if (path === '/view') {
    return new Response(viewHTML, {
      headers: {
        'Content-Type': 'text/html',
        ...getCorsHeaders(request),
      },
    });
  }
  
  if (path === '/health') {
    return new Response(JSON.stringify({ status: 'healthy' }), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
  
  // Serve static files (fallback crypto)
  if (path === '/static/fallback-crypto.js') {
    return new Response(fallbackCryptoJS, {
      headers: {
        'Content-Type': 'application/javascript',
        ...getCorsHeaders(request),
      },
    });
  }
  
  return new Response('Not Found', { 
    status: 404,
    headers: getCorsHeaders(request),
  });
}

/**
 * Handle POST requests
 */
async function handlePost(request, env) {
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
    
    if (path === '/api/update-custom-name') {
      return await handleUpdateCustomName(body, env, request);
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

/**
 * Handle message creation
 */
async function handleCreateMessage(body, env, request) {
  const { encrypted_message, encrypted = 'true', iv, salt, ttl = 30, multiopen = true } = body;
  
  if (!encrypted_message || !iv || !salt) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
  
  // Calculate TTL
  const messageTtl = ttl === 0 ? 9999999999 : getTimestamp() + (ttl * 24 * 60 * 60);
  
  // Generate unique message ID
  const messageId = generateRandomString(25);
  
  // Create message data
  const messageData = {
    multiopen,
    ttl: messageTtl,
    uid: '',
    encrypted,
    encrypted_message,
    message: '',
    iv,
    salt,
    custom_name: body.custom_name || '',
  };
  
  // Store in R2
  const success = await storeMessage(env, messageId, messageData);
  
  if (!success) {
    return new Response(JSON.stringify({ error: 'Failed to store message' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
  
  const domain = env.DOMAIN || 'inigma.idone.su';
  
  return new Response(JSON.stringify({
    url: `https://${domain}/`,
    view: messageId,
  }), {
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(request),
    },
  });
}

/**
 * Handle message viewing
 */
async function handleViewMessage(body, env, request) {
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
    return new Response(JSON.stringify(data), {
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

/**
 * Handle owner update
 */
async function handleUpdateOwner(body, env, request) {
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
  data.message = '';
  data.encrypted = 'true';
  data.custom_name = data.custom_name || '';
  
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

/**
 * Handle listing user secrets
 */
async function handleListSecrets(body, env, request) {
  const { uid, page = 1, per_page = 10 } = body;
  
  if (!uid) {
    return new Response(JSON.stringify({ error: 'Missing uid' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
  
  try {
    const currentTime = getTimestamp();
    const userSecrets = [];
    
    // List all objects in R2
    const list = await env.INIGMA_STORAGE.list();
    
    for (const object of list.objects) {
      try {
        const messageData = await retrieveMessage(env, object.key);
        
        if (messageData && messageData.uid === uid) {
          // Calculate days remaining
          let daysRemaining;
          if (messageData.ttl === 9999999999) {
            daysRemaining = -1; // Permanent
          } else {
            daysRemaining = Math.max(0, Math.floor((messageData.ttl - currentTime) / (24 * 60 * 60)));
          }
          
          // Skip expired secrets
          if (messageData.ttl < currentTime && messageData.ttl !== 9999999999) {
            continue;
          }
          
          userSecrets.push({
            id: object.key,
            custom_name: messageData.custom_name || '',
            days_remaining: daysRemaining,
            created_time: new Date(object.uploaded).getTime()
          });
        }
      } catch (error) {
        console.error(`Error processing message ${object.key}:`, error);
      }
    }
    
    // Sort by creation time (newest first)
    userSecrets.sort((a, b) => b.created_time - a.created_time);
    
    // Pagination
    const total = userSecrets.length;
    const perPage = Math.min(per_page, 50); // Max 50 per page
    const startIdx = (page - 1) * perPage;
    const endIdx = startIdx + perPage;
    
    const paginatedSecrets = userSecrets.slice(startIdx, endIdx);
    
    // Remove created_time from response
    for (const secret of paginatedSecrets) {
      delete secret.created_time;
    }
    
    return new Response(JSON.stringify({
      secrets: paginatedSecrets,
      page: page,
      per_page: perPage,
      total: total,
      has_more: endIdx < total
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
    
  } catch (error) {
    console.error('Error listing secrets:', error);
    return new Response(JSON.stringify({ error: 'Failed to list secrets' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
}

/**
 * Handle updating custom name
 */
async function handleUpdateCustomName(body, env, request) {
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

/**
 * Handle scheduled events (cleanup)
 */
async function handleScheduled(event, env, ctx) {
  ctx.waitUntil(cleanupOldMessages(env));
}

/**
 * Main worker handler
 */
export default {
  async fetch(request, env, ctx) {
    const method = request.method;
    
    if (method === 'OPTIONS') {
      return handleOptions(request);
    }
    
    if (method === 'GET') {
      return await handleGet(request, env);
    }
    
    if (method === 'POST') {
      return await handlePost(request, env);
    }
    
    return new Response('Method not allowed', { 
      status: 405,
      headers: getCorsHeaders(request),
    });
  },
  
  async scheduled(event, env, ctx) {
    return await handleScheduled(event, env, ctx);
  },
};

// Include HTML templates and static files
// These will be injected during build process
// ${TEMPLATE_PLACEHOLDER}
