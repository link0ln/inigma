/**
 * Security utilities for XSS prevention
 * This file provides functions to sanitize user input and prevent XSS attacks
 */

class SecurityUtils {
    /**
     * HTML encode a string to prevent XSS
     * @param {string} str - The string to encode
     * @returns {string} - HTML encoded string
     */
    static htmlEncode(str) {
        if (typeof str !== 'string') return '';
        
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Sanitize text content for safe display
     * @param {string} text - The text to sanitize
     * @returns {string} - Sanitized text
     */
    static sanitizeText(text) {
        if (typeof text !== 'string') return '';
        
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    /**
     * Validate and sanitize URL parameters
     * @param {string} param - The URL parameter to validate
     * @returns {string} - Sanitized parameter
     */
    static sanitizeUrlParam(param) {
        if (typeof param !== 'string') return '';
        
        // Only allow alphanumeric, dash, and underscore characters
        return param.replace(/[^a-zA-Z0-9_-]/g, '');
    }

    /**
     * Validate custom name input
     * @param {string} name - The custom name to validate
     * @returns {string} - Sanitized name
     */
    static sanitizeCustomName(name) {
        if (typeof name !== 'string') return '';
        
        // Remove HTML tags and limit length
        const sanitized = name
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/[<>"/\\]/g, '') // Remove dangerous characters
            .trim()
            .substring(0, 100); // Limit length
        
        return sanitized;
    }

    /**
     * Safe way to set text content using Alpine.js
     * @param {string} text - The text to safely set
     * @returns {string} - Safe text for x-text directive
     */
    static safeText(text) {
        if (typeof text !== 'string') return '';
        return this.htmlEncode(text);
    }

    /**
     * Validate message ID format
     * @param {string} id - The message ID to validate
     * @returns {boolean} - True if valid, false otherwise
     */
    static isValidMessageId(id) {
        if (typeof id !== 'string') return false;
        return /^[a-zA-Z0-9_-]{1,50}$/.test(id);
    }

    /**
     * Generate Content Security Policy header value
     * @returns {string} - CSP header value
     */
    static getCSPHeader() {
        return [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://unpkg.com https://cdnjs.cloudflare.com",
            "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com",
            "font-src 'self' https://cdnjs.cloudflare.com",
            "img-src 'self' data:",
            "connect-src 'self'",
            "frame-ancestors 'none'",
            "object-src 'none'",
            "base-uri 'self'"
        ].join('; ');
    }

    /**
     * Safe JSON parse with error handling
     * @param {string} jsonString - JSON string to parse
     * @returns {object|null} - Parsed object or null if invalid
     */
    static safeJsonParse(jsonString) {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.error('Invalid JSON:', error);
            return null;
        }
    }

    /**
     * Rate limiting check (simple implementation)
     * @param {string} identifier - Unique identifier for rate limiting
     * @param {number} maxRequests - Maximum requests allowed
     * @param {number} windowMs - Time window in milliseconds
     * @returns {boolean} - True if request is allowed
     */
    static checkRateLimit(identifier, maxRequests = 10, windowMs = 60000) {
        const key = `rateLimit_${identifier}`;
        const now = Date.now();
        
        let requests = JSON.parse(localStorage.getItem(key) || '[]');
        
        // Remove old requests outside the window
        requests = requests.filter(timestamp => now - timestamp < windowMs);
        
        if (requests.length >= maxRequests) {
            return false;
        }
        
        requests.push(now);
        localStorage.setItem(key, JSON.stringify(requests));
        
        return true;
    }
}

// Make SecurityUtils available globally
window.SecurityUtils = SecurityUtils;
