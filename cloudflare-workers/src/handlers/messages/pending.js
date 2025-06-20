/**
 * Handle listing pending secrets
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { getTimestamp } from '../../utils/validation.js';
import { retrieveMessage } from '../../utils/storage.js';

export async function handleListPendingSecrets(body, env, request) {
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
    const pendingSecrets = [];
    
    // List all objects in R2
    const list = await env.INIGMA_STORAGE.list();
    
    for (const object of list.objects) {
      try {
        const messageData = await retrieveMessage(env, object.key);
        
        // Check if this secret was created by the user and is still unclaimed
        if (messageData && 
            messageData.creator_uid === uid && 
            messageData.uid === '') {  // uid is empty means unclaimed
          
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
          
          pendingSecrets.push({
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
    pendingSecrets.sort((a, b) => b.created_time - a.created_time);
    
    // Pagination
    const total = pendingSecrets.length;
    const perPage = Math.min(per_page, 50); // Max 50 per page
    const startIdx = (page - 1) * perPage;
    const endIdx = startIdx + perPage;
    
    const paginatedSecrets = pendingSecrets.slice(startIdx, endIdx);
    
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
    console.error('Error listing pending secrets:', error);
    return new Response(JSON.stringify({ error: 'Failed to list pending secrets' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }
}