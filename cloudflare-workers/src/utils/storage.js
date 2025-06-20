/**
 * R2 Storage utility functions
 */

import { DEFAULT_CLEANUP_DAYS } from '../constants/config.js';
import { getTimestamp } from './validation.js';

/**
 * Store message data in R2
 */
export async function storeMessage(env, messageId, data) {
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
export async function retrieveMessage(env, messageId) {
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
export async function deleteMessage(env, messageId) {
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
export async function cleanupOldMessages(env) {
  try {
    const cleanupDays = parseInt(env.CLEANUP_DAYS || DEFAULT_CLEANUP_DAYS);
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