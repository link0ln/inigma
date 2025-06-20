/**
 * Security utilities for XSS prevention
 */
class SecurityUtils {
    static htmlEncode(str) {
        if (typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

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

    static sanitizeUrlParam(param) {
        if (typeof param !== 'string') return '';
        return param.replace(/[^a-zA-Z0-9_-]/g, '');
    }

    static sanitizeCustomName(name) {
        if (typeof name !== 'string') return '';
        const sanitized = name
            .replace(/<[^>]*>/g, '')
            .replace(/[<>"/\\]/g, '')
            .trim()
            .substring(0, 100);
        return sanitized;
    }

    static safeText(text) {
        if (typeof text !== 'string') return '';
        return this.htmlEncode(text);
    }

    static isValidMessageId(id) {
        if (typeof id !== 'string') return false;
        return /^[a-zA-Z0-9_-]{1,50}$/.test(id);
    }

    static checkRateLimit(identifier, maxRequests = 10, windowMs = 60000) {
        const key = `rateLimit_${identifier}`;
        const now = Date.now();
        let requests = JSON.parse(localStorage.getItem(key) || '[]');
        requests = requests.filter(timestamp => now - timestamp < windowMs);
        if (requests.length >= maxRequests) {
            return false;
        }
        requests.push(now);
        localStorage.setItem(key, JSON.stringify(requests));
        return true;
    }
}
window.SecurityUtils = SecurityUtils;