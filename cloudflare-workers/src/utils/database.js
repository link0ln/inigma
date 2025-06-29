/**
 * D1 Database utility functions for Inigma
 */

import { DEFAULT_CLEANUP_DAYS, PERMANENT_TTL } from '../constants/config.js';
import { getTimestamp, calculateTimeRemaining } from './validation.js';

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
    
    return result.success;
  } catch (error) {
    console.error('Error storing message:', error);
    return false;
  }
}

/**
 * Retrieve message data from D1
 */
export async function retrieveMessage(env, messageId) {
  try {
    const stmt = env.INIGMA_DB.prepare('SELECT * FROM messages WHERE id = ?');
    const result = await stmt.bind(messageId).first();
    
    return result || null;
  } catch (error) {
    console.error('Error retrieving message:', error);
    return null;
  }
}

/**
 * Update message owner and content
 */
export async function updateMessageOwner(env, messageId, uid, encryptedMessage, iv, salt) {
  try {
    const stmt = env.INIGMA_DB.prepare(`
      UPDATE messages 
      SET uid = ?, encrypted_message = ?, iv = ?, salt = ?
      WHERE id = ? AND uid = ''
    `);
    
    const result = await stmt.bind(uid, encryptedMessage, iv, salt, messageId).run();
    console.log(`Update message owner result: success=${result.success}, changes=${result.changes}`);
    
    // D1 sometimes reports changes as 0 even when successful, so let's verify
    if (result.success !== false) {
      // Double-check by retrieving the message
      const checkStmt = env.INIGMA_DB.prepare('SELECT uid FROM messages WHERE id = ?');
      const checkResult = await checkStmt.bind(messageId).first();
      
      if (checkResult && checkResult.uid === uid) {
        console.log(`Message owner update verified`);
        return true;
      }
    }
    
    return result.changes > 0;
  } catch (error) {
    console.error('Error updating message owner:', error);
    return false;
  }
}

/**
 * Update custom name for a message
 */
export async function updateCustomName(env, messageId, uid, customName) {
  try {
    const stmt = env.INIGMA_DB.prepare(`
      UPDATE messages 
      SET custom_name = ?
      WHERE id = ? AND uid = ?
    `);
    
    const result = await stmt.bind(customName, messageId, uid).run();
    console.log(`Update custom name result: success=${result.success}, changes=${result.changes}`);
    
    // D1 sometimes reports changes as 0 even when successful, so let's verify
    if (result.success !== false) {
      // Double-check by retrieving the message
      const checkStmt = env.INIGMA_DB.prepare('SELECT custom_name FROM messages WHERE id = ? AND uid = ?');
      const checkResult = await checkStmt.bind(messageId, uid).first();
      
      if (checkResult && checkResult.custom_name === customName) {
        console.log(`Custom name update verified`);
        return true;
      }
    }
    
    return result.changes > 0;
  } catch (error) {
    console.error('Error updating custom name:', error);
    return false;
  }
}

/**
 * Delete message from D1
 */
export async function deleteMessage(env, messageId, uid) {
  try {
    const stmt = env.INIGMA_DB.prepare(`
      DELETE FROM messages 
      WHERE id = ? AND (uid = ? OR (uid = '' AND creator_uid = ?))
    `);
    
    const result = await stmt.bind(messageId, uid, uid).run();
    console.log(`Delete message result: success=${result.success}, changes=${result.changes}`);
    
    // D1 sometimes reports changes as 0 even when successful, so let's verify
    if (result.success !== false) {
      // Double-check by trying to retrieve the message
      const checkStmt = env.INIGMA_DB.prepare('SELECT id FROM messages WHERE id = ?');
      const checkResult = await checkStmt.bind(messageId).first();
      
      if (!checkResult) {
        console.log(`Message deletion verified`);
        return true;
      }
    }
    
    return result.changes > 0;
  } catch (error) {
    console.error('Error deleting message:', error);
    return false;
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
 * Cleanup old messages
 */
export async function cleanupOldMessages(env) {
  try {
    const cleanupDays = parseInt(env.CLEANUP_DAYS || DEFAULT_CLEANUP_DAYS);
    const currentTime = getTimestamp();
    const cutoffTime = currentTime - (cleanupDays * 24 * 60 * 60);
    
    // Delete expired messages and old messages
    const stmt = env.INIGMA_DB.prepare(`
      DELETE FROM messages 
      WHERE (ttl < ? AND ttl != ?) OR created_at < ?
    `);
    
    const result = await stmt.bind(currentTime, PERMANENT_TTL, cutoffTime).run();
    const deletedCount = result.changes || 0;
    
    console.log(`Cleanup completed. Deleted ${deletedCount} expired messages.`);
    return deletedCount;
  } catch (error) {
    console.error('Error during cleanup:', error);
    return 0;
  }
}
