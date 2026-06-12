/**
 * D1 Database utility functions for Inigma
 */

import { PERMANENT_TTL } from '../constants/config.js';
import { getTimestamp, calculateTimeRemaining } from './validation.js';

/**
 * Database result type:
 *   { ok: true, data?: any }
 *   { ok: false, error: 'not_found' | 'access_denied' | 'already_owned' | 'db_error', message?: string }
 */

/**
 * Store message data in D1
 */
export async function storeMessage(env, messageId, data) {
  try {
    const stmt = env.INIGMA_DB.prepare(`
      INSERT INTO messages
      (id, ttl, uid, encrypted_message, iv, salt, custom_name, creator_uid)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await stmt.bind(
      messageId,
      data.ttl,
      data.uid || '',
      data.encrypted_message,
      data.iv,
      data.salt,
      data.custom_name || '',
      data.creator_uid || ''
    ).run();

    return result.success
      ? { ok: true }
      : { ok: false, error: 'db_error', message: 'INSERT returned failure' };
  } catch (error) {
    console.error('Error storing message:', error);
    return { ok: false, error: 'db_error', message: error.message };
  }
}

/**
 * Retrieve message data from D1
 */
export async function retrieveMessage(env, messageId) {
  try {
    const stmt = env.INIGMA_DB.prepare('SELECT * FROM messages WHERE id = ?');
    const result = await stmt.bind(messageId).first();

    return result
      ? { ok: true, data: result }
      : { ok: false, error: 'not_found' };
  } catch (error) {
    console.error('Error retrieving message:', error);
    return { ok: false, error: 'db_error', message: error.message };
  }
}

/**
 * Update message owner and content
 */
export async function updateMessageOwner(env, messageId, uid, encryptedMessage, iv, salt) {
  try {
    const updateStmt = env.INIGMA_DB.prepare(`
      UPDATE messages
      SET uid = ?, encrypted_message = ?, iv = ?, salt = ?
      WHERE id = ? AND uid = ''
    `).bind(uid, encryptedMessage, iv, salt, messageId);

    const checkStmt = env.INIGMA_DB.prepare(
      'SELECT uid FROM messages WHERE id = ?'
    ).bind(messageId);

    const [updateResult, checkResult] = await env.INIGMA_DB.batch([updateStmt, checkStmt]);
    console.log(`Update message owner result: success=${updateResult.success}, changes=${updateResult.meta.changes}`);

    if (updateResult.meta.changes > 0 || (checkResult.results.length > 0 && checkResult.results[0].uid === uid)) {
      return { ok: true };
    }

    // Distinguish: message not found vs already owned
    if (checkResult.results.length === 0) {
      return { ok: false, error: 'not_found' };
    }
    return { ok: false, error: 'already_owned' };
  } catch (error) {
    console.error('Error updating message owner:', error);
    return { ok: false, error: 'db_error', message: error.message };
  }
}

/**
 * Update custom name for a message
 */
export async function updateCustomName(env, messageId, uid, customName) {
  try {
    const updateStmt = env.INIGMA_DB.prepare(`
      UPDATE messages
      SET custom_name = ?
      WHERE id = ? AND uid = ?
    `).bind(customName, messageId, uid);

    const checkStmt = env.INIGMA_DB.prepare(
      'SELECT custom_name FROM messages WHERE id = ? AND uid = ?'
    ).bind(messageId, uid);

    const [updateResult, checkResult] = await env.INIGMA_DB.batch([updateStmt, checkStmt]);

    if (updateResult.meta.changes > 0 || (checkResult.results.length > 0 && checkResult.results[0].custom_name === customName)) {
      return { ok: true };
    }

    return { ok: false, error: 'not_found' };
  } catch (error) {
    console.error('Error updating custom name:', error);
    return { ok: false, error: 'db_error', message: error.message };
  }
}

/**
 * Delete message from D1
 */
export async function deleteMessage(env, messageId, uid) {
  try {
    const deleteResult = await env.INIGMA_DB.prepare(`
      DELETE FROM messages
      WHERE id = ? AND (uid = ? OR (uid = '' AND creator_uid = ?))
    `).bind(messageId, uid, uid).run();

    if (deleteResult.meta.changes > 0) {
      return { ok: true };
    }

    return { ok: false, error: 'not_found' };
  } catch (error) {
    console.error('Error deleting message:', error);
    return { ok: false, error: 'db_error', message: error.message };
  }
}

/**
 * List user's owned secrets with pagination
 */
export async function listUserSecrets(env, uid, page = 1, perPage = 10) {
  try {
    const currentTime = getTimestamp();
    const offset = (page - 1) * perPage;
    
    // Get total count
    const countStmt = env.INIGMA_DB.prepare(`
      SELECT COUNT(*) as total FROM messages 
      WHERE uid = ? AND (ttl > ? OR ttl = ?)
    `);
    const countResult = await countStmt.bind(uid, currentTime, PERMANENT_TTL).first();
    const total = countResult?.total || 0;
    
    // Get paginated results
    const stmt = env.INIGMA_DB.prepare(`
      SELECT id, custom_name, ttl, created_at 
      FROM messages 
      WHERE uid = ? AND (ttl > ? OR ttl = ?)
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const results = await stmt.bind(uid, currentTime, PERMANENT_TTL, perPage, offset).all();
    
    const secrets = results.results.map(row => {
      // Calculate time remaining with smart formatting
      const timeRemaining = calculateTimeRemaining(row.ttl, currentTime);
      
      return {
        id: row.id,
        custom_name: row.custom_name || "",
        days_remaining: timeRemaining.value,
        time_remaining_display: timeRemaining.display,
        time_remaining_type: timeRemaining.type
      };
    });
    
    return {
      secrets,
      page,
      per_page: perPage,
      total,
      has_more: (offset + perPage) < total
    };
  } catch (error) {
    console.error('Error listing user secrets:', error);
    return { secrets: [], page, per_page: perPage, total: 0, has_more: false };
  }
}

/**
 * List user's pending (unclaimed) secrets with pagination
 */
export async function listPendingSecrets(env, creatorUid, page = 1, perPage = 10) {
  try {
    const currentTime = getTimestamp();
    const offset = (page - 1) * perPage;
    
    // Get total count
    const countStmt = env.INIGMA_DB.prepare(`
      SELECT COUNT(*) as total FROM messages 
      WHERE creator_uid = ? AND uid = '' AND (ttl > ? OR ttl = ?)
    `);
    const countResult = await countStmt.bind(creatorUid, currentTime, PERMANENT_TTL).first();
    const total = countResult?.total || 0;
    
    // Get paginated results
    const stmt = env.INIGMA_DB.prepare(`
      SELECT id, custom_name, ttl, created_at 
      FROM messages 
      WHERE creator_uid = ? AND uid = '' AND (ttl > ? OR ttl = ?)
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const results = await stmt.bind(creatorUid, currentTime, PERMANENT_TTL, perPage, offset).all();
    
    const secrets = results.results.map(row => {
      // Calculate time remaining with smart formatting
      const timeRemaining = calculateTimeRemaining(row.ttl, currentTime);
      
      return {
        id: row.id,
        custom_name: row.custom_name || "",
        days_remaining: timeRemaining.value,
        time_remaining_display: timeRemaining.display,
        time_remaining_type: timeRemaining.type
      };
    });
    
    return {
      secrets,
      page,
      per_page: perPage,
      total,
      has_more: (offset + perPage) < total
    };
  } catch (error) {
    console.error('Error listing pending secrets:', error);
    return { secrets: [], page, per_page: perPage, total: 0, has_more: false };
  }
}

/**
 * Cleanup expired messages.
 * Permanent messages (ttl = PERMANENT_TTL) and messages whose TTL has not
 * passed are never deleted, regardless of age.
 */
export async function cleanupOldMessages(env) {
  try {
    const currentTime = getTimestamp();

    const stmt = env.INIGMA_DB.prepare(`
      DELETE FROM messages
      WHERE ttl < ? AND ttl != ?
    `);

    const result = await stmt.bind(currentTime, PERMANENT_TTL).run();
    const deletedCount = result.meta.changes || 0;
    
    console.log(`Cleanup completed. Deleted ${deletedCount} expired messages.`);
    return deletedCount;
  } catch (error) {
    console.error('Error during cleanup:', error);
    return 0;
  }
}
