/**
 * Handle listing user secrets
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { isValidUid, validatePagination } from '../../utils/validation.js';
import { listUserSecrets } from '../../utils/database.js';

export async function handleListSecrets(body, env, request) {
  const { uid, page = 1, per_page = 10 } = body;
  
  if (!uid || !isValidUid(uid)) {
    return new Response(JSON.stringify({ error: 'Invalid or missing uid' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }

  // Validate and sanitize pagination
  const { page: validPage, perPage: validPerPage } = validatePagination(page, per_page);
  
  try {
    // Get user secrets from D1
    const result = await listUserSecrets(env, uid, validPage, validPerPage);
    
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  } catch (error) {
    console.error('Error listing secrets:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
}