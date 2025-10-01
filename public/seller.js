// Seller Dashboard JavaScript

let currentUser = null;
let sellerId = null;
let materials = [];
let categories = [];

// Initialize the seller dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication first
    currentUser = getCurrentUser();
    if (!currentUser) {
        // Redirect to auth page if not logged in
        window.location.href = '/auth.html';
        return;
    }
    
    // Validate user exists on server
    validateUserWithServer();
});

// Authentication functions
function getCurrentUser() {
    const userStr = localStorage.getItem('greenscore-user');
    return userStr ? JSON.parse(userStr) : null;
}

async function validateUserWithServer() {
    if (!currentUser || !currentUser.id) {
        redirectToAuth();
        return;
    }
    
    try {
        console.log('🔍 Validating user with server...');
        const response = await fetch(`/api/users/${currentUser.id}/validate`);
        
        if (!response.ok || response.status === 404) {
            console.log('❌ User validation failed - user not found in database');
            redirectToAuth();
            return;
        }
        
        const result = await response.json();
        
        if (!result.success) {
            console.log('❌ User validation failed');
            redirectToAuth();
            return;
        }
        
        console.log('✅ User validation successful');
        // Continue with initialization
        initializeDashboard();
        
    } catch (error) {
        console.error('❌ Error validating user:', error);
        redirectToAuth();
    }
}

function redirectToAuth() {
    localStorage.removeItem('greenscore-user'); // Clear invalid session
    window.location.href = '/auth.html';
}

function initializeDashboard() {
    sellerId = currentUser.id;
    
    // Update welcome message
    if (currentUser.name) {
        document.getElementById('seller-name').textContent = currentUser.name;
    }
    
    loadCategories();
    loadInventory();
    setupEventListeners();
    updateStats();
}

function signOut() {
    localStorage.removeItem('greenscore-user');
    window.location.href = '/';
}

// Load categories from API
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        categories = await response.json();
        
        // Populate category filters and selects
        populateCategoryFilters();
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Populate category dropdowns
function populateCategoryFilters() {
    const categoryFilter = document.getElementById('category-filter');
    const itemCategory = document.getElementById('item-category');
    
    categories.forEach(category => {
        const option1 = document.createElement('option');
        option1.value = category;
        option1.textContent = category;
        categoryFilter.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = category;
        option2.textContent = category;
        itemCategory.appendChild(option2);
    });
}

// Load seller's inventory
async function loadInventory() {
    try {
        // Get filter values
        const projectFilter = document.getElementById('project-filter')?.value || 'all';
        const inventoryTypeFilter = document.getElementById('inventory-type-filter')?.value || 'all';
        const listingTypeFilter = document.getElementById('listing-type-filter')?.value || 'all';
        
        // Build URL with query parameters
        let url = `/api/seller/${sellerId}/materials?`;
        const params = new URLSearchParams();
        
        if (projectFilter !== 'all') params.append('projectId', projectFilter);
        if (inventoryTypeFilter !== 'all') params.append('inventoryType', inventoryTypeFilter);
        if (listingTypeFilter !== 'all') params.append('listingType', listingTypeFilter);
        
        const response = await fetch(url + params.toString());
        materials = await response.json();
        
        displayInventory();
        updateStats();
    } catch (error) {
        console.error('Error loading inventory:', error);
    }
}

// Display inventory in grid
function displayInventory() {
    const inventoryGrid = document.getElementById('inventory-grid');
    const categoryFilter = document.getElementById('category-filter').value;
    const searchTerm = document.getElementById('search-inventory').value.toLowerCase();
    
    let filteredMaterials = materials;
    
    // Filter by category
    if (categoryFilter && categoryFilter !== 'all') {
        filteredMaterials = filteredMaterials.filter(material => 
            material.category === categoryFilter
        );
    }
    
    // Filter by search term
    if (searchTerm) {
        filteredMaterials = filteredMaterials.filter(material =>
            material.material.toLowerCase().includes(searchTerm) ||
            material.brand.toLowerCase().includes(searchTerm) ||
            material.specs.toLowerCase().includes(searchTerm)
        );
    }
    
    if (filteredMaterials.length === 0) {
        inventoryGrid.innerHTML = `
            <div class="no-inventory">
                <i class="fas fa-boxes"></i>
                <h3>No inventory found</h3>
                <p>Upload your first CSV file or add items manually to get started.</p>
            </div>
        `;
        return;
    }
    
    inventoryGrid.innerHTML = filteredMaterials.map(material => `
        <div class="inventory-item">
            <div class="item-header">
                <span class="item-category">${material.category || 'Other'}</span>
                ${material.is_being_edited ? 
                    `<span class="editing-indicator" style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                        <i class="fas fa-lock"></i> Being Edited
                    </span>` : ''
                }
            </div>
            <div class="item-details">
                <h4>${material.material}</h4>
                <div class="item-meta">
                    <span><strong>Brand:</strong> ${material.brand || 'N/A'}</span>
                    <span><strong>Condition:</strong> ${material.condition || 'N/A'}</span>
                    <span><strong>Quantity:</strong> ${material.qty} ${material.unit || 'pcs'}</span>
                    <span><strong>MRP:</strong> ₹${material.mrp || 0}</span>
                </div>
                <p><strong>Specs:</strong> ${material.specs || 'No specifications'}</p>
            </div>
            <div class="item-price">
                <div class="price">₹${material.priceToday || 0}</div>
                <small>Per ${material.unit || 'piece'}</small>
            </div>
            <div class="item-actions" style="display: flex; gap: 10px; margin-top: 15px;">
                <button class="btn btn-primary btn-sm" onclick="editMaterial('${material.id}')" style="flex: 1;">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteMaterial('${material.id}')" style="flex: 1;">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

// Update dashboard statistics
function updateStats() {
    const totalItems = materials.reduce((sum, material) => sum + (material.qty || 0), 0);
    const totalValue = materials.reduce((sum, material) => 
        sum + ((material.priceToday || 0) * (material.qty || 0)), 0
    );
    const activeListings = materials.filter(material => material.qty > 0).length;
    
    document.getElementById('total-items').textContent = totalItems;
    document.getElementById('total-value').textContent = formatIndianCurrency ? formatIndianCurrency(totalValue) : `₹${totalValue.toFixed(2)}`;
    document.getElementById('active-listings').textContent = activeListings;
}

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('onclick').match(/'([^']+)'/)[1];
            showTab(tabId);
        });
    });
    
    // File upload
    const fileInput = document.getElementById('csv-file');
    const uploadArea = document.getElementById('upload-area');
    const uploadBtn = document.getElementById('upload-btn');
    
    if (uploadArea) {
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('drop', handleDrop);
        uploadArea.addEventListener('dragleave', handleDragLeave);
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }
    
    if (uploadBtn) {
        uploadBtn.addEventListener('click', uploadCSV);
    }
    
    // Manual item form
    const manualItemForm = document.getElementById('manual-item-form');
    if (manualItemForm) {
        manualItemForm.addEventListener('submit', addManualItem);
    }
    
    // Search and filter
    const searchInventory = document.getElementById('search-inventory');
    if (searchInventory) {
        searchInventory.addEventListener('input', displayInventory);
    }
    
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', displayInventory);
    }
    
    // Add event listeners for inventory filters
    const projectFilter = document.getElementById('project-filter');
    if (projectFilter) {
        projectFilter.addEventListener('change', loadInventory);
    }
    
    const inventoryTypeFilter = document.getElementById('inventory-type-filter');
    if (inventoryTypeFilter) {
        inventoryTypeFilter.addEventListener('change', loadInventory);
    }
    
    const listingTypeFilter = document.getElementById('listing-type-filter');
    if (listingTypeFilter) {
        listingTypeFilter.addEventListener('change', loadInventory);
    }
}

// Tab switching function
function showTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabId).classList.add('active');
    
    // Add active class to clicked button
    event.target.classList.add('active');
}

// File drag and drop handlers
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'text/csv') {
        document.getElementById('csv-file').files = files;
        handleFileSelect();
    }
}

// Handle file selection
function handleFileSelect() {
    const fileInput = document.getElementById('csv-file');
    const uploadBtn = document.getElementById('upload-btn');
    const uploadArea = document.getElementById('upload-area');
    
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        uploadArea.innerHTML = `
            <div class="upload-content">
                <i class="fas fa-file-csv"></i>
                <h3>${file.name}</h3>
                <p>Ready to upload</p>
            </div>
        `;
        uploadBtn.disabled = false;
    }
}

// Upload CSV file
async function uploadCSV() {
    const fileInput = document.getElementById('csv-file');
    const uploadProgress = document.getElementById('upload-progress');
    const uploadBtn = document.getElementById('upload-btn');
    
    if (!fileInput.files.length) {
        showNotification('Please select a CSV file', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('csvFile', fileInput.files[0]);
    formData.append('sellerId', sellerId);
    
    uploadBtn.disabled = true;
    uploadProgress.style.display = 'block';
    
    try {
        const response = await fetch('/api/upload-csv', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`Successfully uploaded ${result.count} items`, 'success');
            loadInventory(); // Refresh inventory
            
            // Reset upload form
            fileInput.value = '';
            document.getElementById('upload-area').innerHTML = `
                <div class="upload-content">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <h3>Drop your CSV file here</h3>
                    <p>or <span class="upload-link">click to browse</span></p>
                </div>
            `;
        } else {
            showNotification('Error uploading file: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('Error uploading file', 'error');
        console.error('Upload error:', error);
    } finally {
        uploadBtn.disabled = false;
        uploadProgress.style.display = 'none';
    }
}

// Add manual item
async function addManualItem(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const material = {
        sellerId: sellerId,
        material: document.getElementById('item-material').value,
        brand: document.getElementById('item-brand').value,
        category: document.getElementById('item-category').value || 'Other',
        qty: parseInt(document.getElementById('item-qty').value),
        unit: document.getElementById('item-unit').value || 'pcs',
        condition: document.getElementById('item-condition').value,
        mrp: parseFloat(document.getElementById('item-mrp').value) || 0,
        priceToday: parseFloat(document.getElementById('item-price-today').value),
        specs: document.getElementById('item-specs').value,
        photo: document.getElementById('item-photo').value,
        pricePurchased: 0,
        inventoryValue: 0,
        inventoryType: 'manual'
    };
    
    try {
        const response = await fetch('/api/materials', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(material)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Item added successfully', 'success');
            e.target.reset();
            loadInventory(); // Refresh inventory
        } else {
            showNotification('Error adding item', 'error');
        }
    } catch (error) {
        showNotification('Error adding item', 'error');
        console.error('Add item error:', error);
    }
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Edit material functions
let currentEditingMaterial = null;

async function editMaterial(materialId) {
    const material = materials.find(m => m.id === materialId);
    if (!material) {
        showNotification('Material not found', 'error');
        return;
    }
    
    try {
        // Try to lock the material for editing
        const lockResponse = await fetch(`/api/materials/${materialId}/lock`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId: sellerId })
        });
        
        const lockResult = await lockResponse.json();
        
        if (!lockResult.success && !lockResult.locked) {
            // Material is locked by another user
            document.getElementById('edit-material-modal').classList.add('show');
            document.getElementById('edit-material-form').style.display = 'none';
            document.getElementById('edit-lock-warning').style.display = 'block';
            return;
        }
        
        // Successfully locked, show edit form
        currentEditingMaterial = materialId;
        
        // Populate the edit form
        document.getElementById('edit-material-id').value = material.id;
        document.getElementById('edit-material-name').value = material.material;
        document.getElementById('edit-brand').value = material.brand || '';
        document.getElementById('edit-category').value = material.category || '';
        document.getElementById('edit-qty').value = material.qty;
        document.getElementById('edit-unit').value = material.unit || 'pcs';
        document.getElementById('edit-condition').value = material.condition || 'good';
        document.getElementById('edit-mrp').value = material.mrp || 0;
        document.getElementById('edit-price-today').value = material.priceToday;
        document.getElementById('edit-specs').value = material.specs || '';
        document.getElementById('edit-photo').value = material.photo || '';
        
        // Populate categories in the edit form
        const editCategorySelect = document.getElementById('edit-category');
        editCategorySelect.innerHTML = '<option value="">Select Category</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            if (category === material.category) {
                option.selected = true;
            }
            editCategorySelect.appendChild(option);
        });
        
        // Show the modal
        document.getElementById('edit-material-modal').classList.add('show');
        document.getElementById('edit-material-form').style.display = 'block';
        document.getElementById('edit-lock-warning').style.display = 'none';
        
    } catch (error) {
        console.error('Error locking material for edit:', error);
        showNotification('Error starting edit session', 'error');
    }
}

async function closeEditModal() {
    // Unlock the material if we're editing it
    if (currentEditingMaterial) {
        try {
            await fetch(`/api/materials/${currentEditingMaterial}/unlock`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: sellerId })
            });
        } catch (error) {
            console.error('Error unlocking material:', error);
        }
        currentEditingMaterial = null;
    }
    
    document.getElementById('edit-material-modal').classList.remove('show');
    document.getElementById('edit-material-form').reset();
}

async function cancelEdit() {
    await closeEditModal();
}

// Setup edit form submission
document.addEventListener('DOMContentLoaded', function() {
    const editForm = document.getElementById('edit-material-form');
    if (editForm) {
        editForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const materialId = document.getElementById('edit-material-id').value;
            
            const updateData = {
                userId: sellerId,
                material: document.getElementById('edit-material-name').value,
                brand: document.getElementById('edit-brand').value,
                category: document.getElementById('edit-category').value || 'Other',
                quantity: parseInt(document.getElementById('edit-qty').value),
                unit: document.getElementById('edit-unit').value || 'pcs',
                condition: document.getElementById('edit-condition').value,
                mrp: parseFloat(document.getElementById('edit-mrp').value) || 0,
                price_today: parseFloat(document.getElementById('edit-price-today').value),
                specs: document.getElementById('edit-specs').value,
                photo: document.getElementById('edit-photo').value
            };
            
            try {
                const response = await fetch(`/api/materials/${materialId}/edit`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updateData)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification('Material updated successfully', 'success');
                    currentEditingMaterial = null;
                    await closeEditModal();
                    await loadInventory(); // Reload inventory to show updates
                } else {
                    showNotification(result.error || 'Error updating material', 'error');
                }
            } catch (error) {
                console.error('Error updating material:', error);
                showNotification('Error updating material', 'error');
            }
        });
    }
});

// Delete material function
async function deleteMaterial(materialId) {
    if (!confirm('Are you sure you want to delete this material?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/seller/${sellerId}/materials/${materialId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Material deleted successfully', 'success');
            await loadInventory(); // Reload inventory
        } else {
            showNotification(result.error || 'Error deleting material', 'error');
        }
    } catch (error) {
        console.error('Error deleting material:', error);
        showNotification('Error deleting material', 'error');
    }
}

// Make functions global
window.showTab = showTab;
window.editMaterial = editMaterial;
window.closeEditModal = closeEditModal;
window.cancelEdit = cancelEdit;
window.deleteMaterial = deleteMaterial;
