// Utility functions for GreenScore Marketplace

/**
 * Format large numbers in Indian number system (lacs/crores)
 * @param {number} amount - The amount to format
 * @param {boolean} showCurrency - Whether to show currency symbol
 * @returns {string} Formatted amount string
 */
function formatIndianCurrency(amount, showCurrency = true) {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return showCurrency ? '₹0' : '0';
    }
    
    const absAmount = Math.abs(amount);
    const currencySymbol = showCurrency ? '₹' : '';
    
    if (absAmount >= 10000000) { // 1 crore = 10,000,000
        const crores = (amount / 10000000).toFixed(2);
        return `${currencySymbol}${crores} Cr`;
    } else if (absAmount >= 100000) { // 1 lac = 100,000
        const lacs = (amount / 100000).toFixed(2);
        return `${currencySymbol}${lacs} L`;
    } else if (absAmount >= 1000) { // 1 thousand
        const thousands = (amount / 1000).toFixed(1);
        return `${currencySymbol}${thousands}K`;
    } else {
        return `${currencySymbol}${amount.toFixed(2)}`;
    }
}

/**
 * Format numbers with Indian number system for display
 * @param {number} number - The number to format
 * @returns {string} Formatted number string
 */
function formatIndianNumber(number) {
    if (number === null || number === undefined || isNaN(number)) {
        return '0';
    }
    
    const absNumber = Math.abs(number);
    
    if (absNumber >= 10000000) { // 1 crore
        const crores = (number / 10000000).toFixed(2);
        return `${crores} Cr`;
    } else if (absNumber >= 100000) { // 1 lac
        const lacs = (number / 100000).toFixed(2);
        return `${lacs} L`;
    } else if (absNumber >= 1000) { // 1 thousand
        const thousands = (number / 1000).toFixed(1);
        return `${thousands}K`;
    } else {
        return number.toLocaleString('en-IN');
    }
}

/**
 * Format currency for small amounts (under 1 lac)
 * @param {number} amount - The amount to format
 * @param {boolean} showCurrency - Whether to show currency symbol
 * @returns {string} Formatted amount string
 */
function formatSmallCurrency(amount, showCurrency = true) {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return showCurrency ? '₹0' : '0';
    }
    
    const currencySymbol = showCurrency ? '₹' : '';
    return `${currencySymbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format date and time for display
 * @param {string|Date} dateString - Date string or Date object
 * @returns {string} Formatted date and time string
 */
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    
    return date.toLocaleString('en-IN', options);
}

/**
 * Format date only (without time)
 * @param {string|Date} dateString - Date string or Date object
 * @returns {string} Formatted date string
 */
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    };
    
    return date.toLocaleDateString('en-IN', options);
}

/**
 * Format time only (without date)
 * @param {string|Date} dateString - Date string or Date object
 * @returns {string} Formatted time string
 */
function formatTime(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return 'Invalid Time';
    
    const options = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    };
    
    return date.toLocaleTimeString('en-IN', options);
}

/**
 * Get relative time string (e.g., "2 hours ago", "3 days ago")
 * @param {string|Date} dateString - Date string or Date object
 * @returns {string} Relative time string
 */
function getRelativeTime(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    
    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
    if (diffDay < 30) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    
    return formatDateTime(dateString);
}

// Export functions for use in other scripts
window.formatIndianCurrency = formatIndianCurrency;
window.formatIndianNumber = formatIndianNumber;
window.formatSmallCurrency = formatSmallCurrency;
window.formatDateTime = formatDateTime;
window.formatDate = formatDate;
window.formatTime = formatTime;
window.getRelativeTime = getRelativeTime;
