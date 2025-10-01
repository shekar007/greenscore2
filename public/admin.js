// Admin Dashboard JavaScript

let currentUser = null;
let users = [];
let materials = [];
let orderRequests = [];
let orders = [];

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Admin Dashboard Loading...');
    
    // Check authentication
    currentUser = getCurrentUser();
    if (!currentUser || currentUser.userType !== 'admin') {
        console.log('❌ Admin access denied');
        window.location.href = '/auth.html';
        return;
    }
    
    initializeAdminDashboard();
});

function getCurrentUser() {
    const userStr = localStorage.getItem('greenscore-user');
    return userStr ? JSON.parse(userStr) : null;
}

async function initializeAdminDashboard() {
    console.log('🚀 Initializing admin dashboard...');
    
    await loadSystemStats();
    await loadUsers();
    
    setupEventListeners();
    
    console.log('✅ Admin dashboard initialized');
}

function setupEventListeners() {
    const materialEditForm = document.getElementById('material-edit-form');
    if (materialEditForm) {
        materialEditForm.addEventListener('submit', updateMaterial);
    }
}

// System Stats
async function loadSystemStats() {
    try {
        const response = await fetch('/api/admin/stats');
        const result = await response.json();
        
        if (result.success) {
            updateStatsDisplay(result.stats);
        }
    } catch (error) {
        console.error('Error loading system stats:', error);
    }
}

function updateStatsDisplay(stats) {
    document.getElementById('stat-users').textContent = formatIndianNumber(stats.totalUsers);
    document.getElementById('stat-materials').textContent = formatIndianNumber(stats.totalMaterials);
    document.getElementById('stat-pending').textContent = formatIndianNumber(stats.pendingRequests);
    document.getElementById('stat-orders').textContent = formatIndianNumber(stats.completedOrders);
    document.getElementById('stat-revenue').textContent = formatIndianCurrency(stats.totalRevenue);
    document.getElementById('stat-transfers').textContent = formatIndianNumber(stats.totalTransfers);
}

// Tab Management
function showAdminTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.admin-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.add('active');
    event.target.classList.add('active');
    
    // Load data for the tab
    switch(tabName) {
        case 'users':
            loadUsers();
            break;
        case 'materials':
            loadMaterials();
            break;
        case 'requests':
            loadOrderRequests();
            break;
        case 'orders':
            loadOrders();
            break;
    }
}

// Users Management
async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users');
        const result = await response.json();
        
        if (result.success) {
            users = result.users;
            displayUsers();
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function displayUsers() {
    const tableBody = document.getElementById('users-table-body');
    
    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem;">No users found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = users.map(user => `
        <tr>
            <td><strong>${user.name}</strong></td>
            <td>${user.email}</td>
            <td>${user.company_name || 'N/A'}</td>
            <td><span class="status-badge status-${user.user_type}">${user.user_type.toUpperCase()}</span></td>
            <td>${user.project_count}</td>
            <td>${user.material_count}</td>
            <td>${user.order_count}</td>
            <td>${formatDateTime(user.created_at)}</td>
            <td><span class="status-badge status-${user.verification_status}">${user.verification_status.toUpperCase()}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-info" onclick="editUser('${user.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteUser('${user.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Materials Management
async function loadMaterials() {
    try {
        const response = await fetch('/api/admin/materials');
        const result = await response.json();
        
        if (result.success) {
            materials = result.materials;
            displayMaterials();
        }
    } catch (error) {
        console.error('Error loading materials:', error);
    }
}

function displayMaterials() {
    const tableBody = document.getElementById('materials-table-body');
    
    if (materials.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem;">No materials found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = materials.map(material => `
        <tr>
            <td>
                <strong>${material.material}</strong><br>
                <small>ID: ${material.id}</small>
            </td>
            <td><code>${material.listing_id || 'N/A'}</code></td>
            <td>${material.seller_name}<br><small>${material.seller_company || ''}</small></td>
            <td>${material.quantity} ${material.unit}</td>
            <td>₹${material.price_today}</td>
            <td><span class="status-badge status-${material.listing_type}">${material.listing_type.toUpperCase()}</span></td>
            <td>${material.pending_requests}</td>
            <td>${material.completed_orders}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-info" onclick="editMaterial('${material.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteMaterial('${material.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Order Requests Management
async function loadOrderRequests() {
    try {
        const response = await fetch('/api/admin/order-requests');
        const result = await response.json();
        
        if (result.success) {
            orderRequests = result.requests;
            displayOrderRequests();
        }
    } catch (error) {
        console.error('Error loading order requests:', error);
    }
}

function displayOrderRequests() {
    const tableBody = document.getElementById('requests-table-body');
    
    if (orderRequests.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No order requests found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = orderRequests.map(request => `
        <tr>
            <td>
                <strong>${request.material_name}</strong><br>
                <small>Listing: ${request.listing_id || 'N/A'}</small>
            </td>
            <td>${request.buyer_name}<br><small>${request.buyer_company || ''}</small></td>
            <td>${request.seller_name}<br><small>${request.seller_company || ''}</small></td>
            <td>${request.quantity}</td>
            <td>${formatIndianCurrency(request.total_amount)}</td>
            <td>
                <span class="status-badge status-${request.status}">${request.status.toUpperCase()}</span>
            </td>
            <td>${formatDateTime(request.created_at)}</td>
            <td>
                <div class="action-buttons">
                    ${request.status === 'pending' ? `
                        <button class="btn btn-sm btn-success" onclick="approveRequest('${request.id}')" title="Approve">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="rejectRequest('${request.id}')" title="Reject">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-info" onclick="viewRequestDetails('${request.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Orders Management
async function loadOrders() {
    try {
        const response = await fetch('/api/admin/orders');
        const result = await response.json();
        
        if (result.success) {
            orders = result.orders;
            displayOrders();
        }
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

function displayOrders() {
    const tableBody = document.getElementById('orders-table-body');
    
    if (orders.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No orders found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = orders.map(order => `
        <tr>
            <td><code>${order.id.substring(0, 8)}...</code></td>
            <td>
                <strong>${order.material_name}</strong><br>
                <small>Listing: ${order.listing_id || 'N/A'}</small>
            </td>
            <td>${order.buyer_name}<br><small>${order.buyer_company || ''}</small></td>
            <td>${order.seller_name}<br><small>${order.seller_company || ''}</small></td>
            <td>${order.quantity}</td>
            <td>${formatIndianCurrency(order.total_amount)}</td>
            <td><span class="status-badge status-${order.status}">${order.status.toUpperCase()}</span></td>
            <td>${formatDateTime(order.created_at)}</td>
        </tr>
    `).join('');
}

// Material Management
function editMaterial(materialId) {
    const material = materials.find(m => m.id === materialId);
    if (!material) return;
    
    document.getElementById('edit-material-id').value = materialId;
    document.getElementById('edit-material-name').value = material.material;
    document.getElementById('edit-brand').value = material.brand || '';
    document.getElementById('edit-quantity').value = material.quantity;
    document.getElementById('edit-unit').value = material.unit || 'pcs';
    document.getElementById('edit-price').value = material.price_today;
    document.getElementById('edit-mrp').value = material.mrp || 0;
    document.getElementById('edit-category').value = material.category;
    document.getElementById('edit-condition').value = material.condition || 'good';
    document.getElementById('edit-listing-type').value = material.listing_type;
    document.getElementById('edit-inventory-type').value = material.inventory_type || 'surplus';
    document.getElementById('edit-specs').value = material.specs || '';
    document.getElementById('edit-photo').value = material.photo || '';
    
    document.getElementById('material-edit-modal').classList.add('show');
}

function closeMaterialEditModal() {
    document.getElementById('material-edit-modal').classList.remove('show');
    document.getElementById('material-edit-form').reset();
}

async function updateMaterial(e) {
    e.preventDefault();
    
    const materialId = document.getElementById('edit-material-id').value;
    const updateData = {
        material: document.getElementById('edit-material-name').value,
        brand: document.getElementById('edit-brand').value,
        quantity: parseInt(document.getElementById('edit-quantity').value),
        unit: document.getElementById('edit-unit').value,
        price_today: parseFloat(document.getElementById('edit-price').value),
        mrp: parseFloat(document.getElementById('edit-mrp').value) || 0,
        category: document.getElementById('edit-category').value,
        condition: document.getElementById('edit-condition').value,
        listing_type: document.getElementById('edit-listing-type').value,
        inventory_type: document.getElementById('edit-inventory-type').value,
        specs: document.getElementById('edit-specs').value,
        photo: document.getElementById('edit-photo').value
    };
    
    try {
        const response = await fetch(`/api/admin/materials/${materialId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        const result = await response.json();
        if (result.success) {
            showNotification('Material updated successfully!', 'success');
            closeMaterialEditModal();
            loadMaterials();
        } else {
            showNotification('Failed to update material', 'error');
        }
    } catch (error) {
        console.error('Error updating material:', error);
        showNotification('Error updating material', 'error');
    }
}

async function deleteMaterial(materialId) {
    if (!confirm('Are you sure you want to delete this material? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/materials/${materialId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        if (result.success) {
            showNotification('Material deleted successfully!', 'success');
            loadMaterials();
            loadSystemStats(); // Refresh stats
        } else {
            showNotification('Failed to delete material', 'error');
        }
    } catch (error) {
        console.error('Error deleting material:', error);
        showNotification('Error deleting material', 'error');
    }
}

// Export Functions
async function exportUsers() {
    try {
        const response = await fetch('/api/admin/export/users');
        if (response.ok) {
            const blob = await response.blob();
            downloadFile(blob, 'users-report.csv');
            showNotification('Users report exported successfully!', 'success');
        }
    } catch (error) {
        console.error('Error exporting users:', error);
        showNotification('Error exporting users', 'error');
    }
}

async function exportMaterials() {
    try {
        const response = await fetch('/api/admin/export/materials');
        if (response.ok) {
            const blob = await response.blob();
            downloadFile(blob, 'materials-report.csv');
            showNotification('Materials report exported successfully!', 'success');
        }
    } catch (error) {
        console.error('Error exporting materials:', error);
        showNotification('Error exporting materials', 'error');
    }
}

async function exportOrderRequests() {
    try {
        const response = await fetch('/api/admin/export/order-requests');
        if (response.ok) {
            const blob = await response.blob();
            downloadFile(blob, 'order-requests-report.csv');
            showNotification('Order requests report exported successfully!', 'success');
        }
    } catch (error) {
        console.error('Error exporting order requests:', error);
        showNotification('Error exporting order requests', 'error');
    }
}

async function exportOrders() {
    try {
        const response = await fetch('/api/admin/export/orders');
        if (response.ok) {
            const blob = await response.blob();
            downloadFile(blob, 'orders-report.csv');
            showNotification('Orders report exported successfully!', 'success');
        }
    } catch (error) {
        console.error('Error exporting orders:', error);
        showNotification('Error exporting orders', 'error');
    }
}

async function exportCompleteReport() {
    try {
        // Export all data as separate files in a zip-like experience
        showNotification('Preparing complete system export...', 'info');
        
        await Promise.all([
            exportUsers(),
            exportMaterials(), 
            exportOrderRequests(),
            exportOrders()
        ]);
        
        showNotification('Complete system export completed!', 'success');
    } catch (error) {
        console.error('Error exporting complete report:', error);
        showNotification('Error exporting complete report', 'error');
    }
}

function downloadFile(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Utility Functions
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function signOut() {
    localStorage.removeItem('greenscore-user');
    window.location.href = '/auth.html';
}

// Make functions globally available
window.showAdminTab = showAdminTab;
window.loadUsers = loadUsers;
window.loadMaterials = loadMaterials;
window.loadOrderRequests = loadOrderRequests;
window.loadOrders = loadOrders;
window.editMaterial = editMaterial;
window.deleteMaterial = deleteMaterial;
window.closeMaterialEditModal = closeMaterialEditModal;
window.exportUsers = exportUsers;
window.exportMaterials = exportMaterials;
window.exportOrderRequests = exportOrderRequests;
window.exportOrders = exportOrders;
window.exportCompleteReport = exportCompleteReport;
// User Management Functions
function editUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    document.getElementById('edit-user-id').value = userId;
    document.getElementById('edit-user-name').value = user.name;
    document.getElementById('edit-user-email').value = user.email;
    document.getElementById('edit-user-company').value = user.company_name || '';
    document.getElementById('edit-user-type').value = user.user_type;
    document.getElementById('edit-user-status').value = user.verification_status || 'active';
    
    document.getElementById('user-edit-modal').classList.add('show');
}

function closeUserEditModal() {
    document.getElementById('user-edit-modal').classList.remove('show');
    document.getElementById('user-edit-form').reset();
}

async function updateUser(e) {
    e.preventDefault();
    
    const userId = document.getElementById('edit-user-id').value;
    const updateData = {
        name: document.getElementById('edit-user-name').value,
        email: document.getElementById('edit-user-email').value,
        company_name: document.getElementById('edit-user-company').value,
        user_type: document.getElementById('edit-user-type').value,
        verification_status: document.getElementById('edit-user-status').value
    };
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        const result = await response.json();
        if (result.success) {
            showNotification('User updated successfully!', 'success');
            closeUserEditModal();
            loadUsers();
            loadSystemStats();
        } else {
            showNotification('Failed to update user', 'error');
        }
    } catch (error) {
        console.error('Error updating user:', error);
        showNotification('Error updating user', 'error');
    }
}

async function deleteUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    if (!confirm(`Are you sure you want to delete user "${user.name}" (${user.email})? This will also delete all their materials and orders. This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        if (result.success) {
            showNotification('User deleted successfully!', 'success');
            loadUsers();
            loadSystemStats();
        } else {
            showNotification('Failed to delete user', 'error');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('Error deleting user', 'error');
    }
}

// Bulk Operations
let selectedItems = new Set();

function toggleSelectAll(checked) {
    const checkboxes = document.querySelectorAll('.item-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = checked;
        if (checked) {
            selectedItems.add(cb.value);
        } else {
            selectedItems.delete(cb.value);
        }
    });
    updateBulkActionButton();
}

function toggleSelectItem(itemId, checked) {
    if (checked) {
        selectedItems.add(itemId);
    } else {
        selectedItems.delete(itemId);
    }
    updateBulkActionButton();
}

function updateBulkActionButton() {
    const bulkBtn = document.getElementById('bulk-action-btn');
    if (bulkBtn) {
        bulkBtn.disabled = selectedItems.size === 0;
        bulkBtn.textContent = selectedItems.size > 0 ? 
            `Bulk Actions (${selectedItems.size} selected)` : 'Bulk Actions';
    }
}

function closeBulkActionsModal() {
    document.getElementById('bulk-actions-modal').classList.remove('show');
}

async function bulkDelete() {
    if (!confirm(`Are you sure you want to delete ${selectedItems.size} items? This action cannot be undone.`)) {
        return;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (const itemId of selectedItems) {
        try {
            const response = await fetch(`/api/admin/materials/${itemId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (error) {
            failCount++;
        }
    }
    
    if (successCount > 0) {
        showNotification(`Successfully deleted ${successCount} items${failCount > 0 ? `, ${failCount} failed` : ''}`, 'success');
        selectedItems.clear();
        loadMaterials();
        loadSystemStats();
    } else {
        showNotification('Failed to delete items', 'error');
    }
    
    closeBulkActionsModal();
}

async function updateOrderStatus(orderId, status) {
    try {
        const response = await fetch(`/api/admin/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        const result = await response.json();
        if (result.success) {
            showNotification(`Order status updated to ${status}`, 'success');
            loadOrders();
        } else {
            showNotification('Failed to update order status', 'error');
        }
    } catch (error) {
        console.error('Error updating order status:', error);
        showNotification('Error updating order status', 'error');
    }
}

// Setup form event listeners
document.addEventListener('DOMContentLoaded', function() {
    const userEditForm = document.getElementById('user-edit-form');
    if (userEditForm) {
        userEditForm.addEventListener('submit', updateUser);
    }
});

window.signOut = signOut;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.closeUserEditModal = closeUserEditModal;
window.closeBulkActionsModal = closeBulkActionsModal;
window.toggleSelectAll = toggleSelectAll;
window.toggleSelectItem = toggleSelectItem;
window.bulkDelete = bulkDelete;
// Order Request Management
async function approveRequest(requestId) {
    try {
        const response = await fetch(`/api/admin/order-requests/${requestId}/approve`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        if (result.success) {
            showNotification('Order request approved successfully!', 'success');
            loadOrderRequests();
            loadSystemStats();
        } else {
            showNotification('Failed to approve request', 'error');
        }
    } catch (error) {
        console.error('Error approving request:', error);
        showNotification('Error approving request', 'error');
    }
}

async function rejectRequest(requestId) {
    if (!confirm('Are you sure you want to reject this order request?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/order-requests/${requestId}/reject`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        if (result.success) {
            showNotification('Order request rejected', 'success');
            loadOrderRequests();
        } else {
            showNotification('Failed to reject request', 'error');
        }
    } catch (error) {
        console.error('Error rejecting request:', error);
        showNotification('Error rejecting request', 'error');
    }
}

function viewRequestDetails(requestId) {
    const request = orderRequests.find(r => r.id === requestId);
    if (!request) return;
    
    alert(`Order Request Details:\n\n` +
          `Material: ${request.material_name}\n` +
          `Listing ID: ${request.listing_id || 'N/A'}\n` +
          `Buyer: ${request.buyer_name} (${request.buyer_email})\n` +
          `Seller: ${request.seller_name} (${request.seller_email})\n` +
          `Quantity: ${request.quantity}\n` +
          `Total Amount: ${formatIndianCurrency(request.total_amount)}\n` +
          `Status: ${request.status}\n` +
          `Notes: ${request.notes || 'None'}\n` +
          `Created: ${new Date(request.created_at).toLocaleString()}`);
}

window.updateOrderStatus = updateOrderStatus;
window.approveRequest = approveRequest;
window.rejectRequest = rejectRequest;
window.viewRequestDetails = viewRequestDetails;
