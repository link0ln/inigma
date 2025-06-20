/**
 * Handle listing pending secrets
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { isValidUid, validatePagination } from '../../utils/validation.js';
import { listPendingSecrets } from '../../utils/database.js';

export async function handleListPendingSecrets(body, env, request) {
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
    // Get pending secrets from D1
    const result = await listPendingSecrets(env, uid, validPage, validPerPage);
    
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  } catch (error) {
    console.error('Error listing pending secrets:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
}