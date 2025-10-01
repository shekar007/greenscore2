// Enhanced Seller Dashboard JavaScript with Database and Multi-format File Support

let currentUser = null;
let materials = [];
let categories = [];
let projects = [];
let currentView = 'grid';

// Initialize the enhanced seller dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication - allow access if user exists
    currentUser = getCurrentUser();
    if (!currentUser) {
        window.location.href = '/auth.html';
        return;
    }
    
    // Update user type to seller for this session
    if (currentUser.userType !== 'seller') {
        currentUser.userType = 'seller';
        localStorage.setItem('greenscore-user', JSON.stringify(currentUser));
    }
    
    // Set user name
    document.getElementById('seller-name').textContent = currentUser.name;
    
    loadCategories();
    loadProjects();
    loadInventory();
    setupEventListeners();
    loadNotifications();
    updateStats();
    
    // Set up periodic notification refresh
    setInterval(loadNotifications, 30000); // Refresh every 30 seconds
});

// Authentication functions
function getCurrentUser() {
    const userStr = localStorage.getItem('greenscore-user');
    return userStr ? JSON.parse(userStr) : null;
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
        populateCategoryFilters();
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Load projects for current seller
async function loadProjects() {
    try {
        const response = await fetch(`/api/projects/${currentUser.id}`);
        projects = await response.json();
        populateProjectSelectors();
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

// Populate project selectors
function populateProjectSelectors() {
    const currentProject = document.getElementById('current-project');
    const projectFilter = document.getElementById('project-filter');
    const targetProject = document.getElementById('target-project');
    
    // Clear existing options
    [currentProject, projectFilter, targetProject].forEach(select => {
        if (select) {
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }
        }
    });
    
    projects.forEach(project => {
        [currentProject, projectFilter, targetProject].forEach(select => {
            if (select) {
                const option = document.createElement('option');
                option.value = project.id;
                option.textContent = project.name;
                select.appendChild(option);
            }
        });
    });
}

// Populate category dropdowns
function populateCategoryFilters() {
    const categoryFilter = document.getElementById('category-filter');
    const itemCategory = document.getElementById('item-category');
    
    categories.forEach(category => {
        [categoryFilter, itemCategory].forEach(select => {
            if (select) {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                select.appendChild(option);
            }
        });
    });
}

// Load seller's inventory with enhanced filtering
async function loadInventory() {
    try {
        const projectId = document.getElementById('project-filter')?.value || 'all';
        const inventoryType = document.getElementById('inventory-type-filter')?.value || 'all';
        const listingType = document.getElementById('listing-type-filter')?.value || 'all';
        
        let url = `/api/seller/${currentUser.id}/materials?`;
        const params = new URLSearchParams();
        
        if (projectId !== 'all') params.append('projectId', projectId);
        if (inventoryType !== 'all') params.append('inventoryType', inventoryType);
        if (listingType !== 'all') params.append('listingType', listingType);
        
        const response = await fetch(url + params.toString());
        materials = await response.json();
        
        displayInventory();
        updateStats();
    } catch (error) {
        console.error('Error loading inventory:', error);
    }
}

// Display inventory in current view (grid or table)
function displayInventory() {
    const categoryFilter = document.getElementById('category-filter').value;
    const searchTerm = document.getElementById('search-inventory').value.toLowerCase();
    
    let filteredMaterials = [...materials];
    
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
            (material.brand && material.brand.toLowerCase().includes(searchTerm)) ||
            (material.specs && material.specs.toLowerCase().includes(searchTerm))
        );
    }
    
    if (currentView === 'grid') {
        displayGridView(filteredMaterials);
    } else {
        displayTableView(filteredMaterials);
    }
}

// Display materials in grid view
function displayGridView(filteredMaterials) {
    const inventoryGrid = document.getElementById('inventory-grid');
    const inventoryTable = document.getElementById('inventory-table');
    
    inventoryGrid.style.display = 'grid';
    inventoryTable.style.display = 'none';
    
    if (filteredMaterials.length === 0) {
        inventoryGrid.innerHTML = `
            <div class="no-inventory">
                <i class="fas fa-boxes"></i>
                <h3>No inventory found</h3>
                <p>Upload your first file or add items manually to get started.</p>
            </div>
        `;
        return;
    }
    
    inventoryGrid.innerHTML = filteredMaterials.map(material => `
        <div class="inventory-item">
            <div class="item-actions">
                <div class="dropdown">
                    <button class="dropdown-btn" onclick="toggleDropdown('${material.id}')">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="dropdown-content" id="dropdown-${material.id}">
                        <div class="dropdown-item resale" onclick="updateListingType('${material.id}', 'resale')">
                            <i class="fas fa-store"></i> For Resale
                        </div>
                        <div class="dropdown-item internal_transfer" onclick="showListingActionModal('${material.id}', 'internal_transfer')">
                            <i class="fas fa-exchange-alt"></i> Internal Transfer
                        </div>
                        <div class="dropdown-item sold" onclick="updateListingType('${material.id}', 'sold')">
                            <i class="fas fa-check-circle"></i> Mark as Sold
                        </div>
                    </div>
                </div>
            </div>
            <div class="item-header">
                <span class="item-category">${material.category || 'Other'}</span>
                <span class="status-badge status-${material.listing_type || material.listingType || 'resale'}">${getStatusText(material.listing_type || material.listingType)}</span>
            </div>
            <div class="item-details">
                <h4>${material.material}</h4>
                <div class="item-meta">
                    <span><strong>Brand:</strong> ${material.brand || 'N/A'}</span>
                    <span><strong>Condition:</strong> ${material.condition || 'N/A'}</span>
                    <span><strong>Quantity:</strong> ${material.qty || material.quantity} ${material.unit || 'pcs'}</span>
                    <span><strong>Project:</strong> ${getProjectName(material.project_id || material.projectId)}</span>
                </div>
                <p><strong>Specs:</strong> ${material.specs || 'No specifications'}</p>
            </div>
            <div class="item-price">
                <div class="price">$${material.price_today || material.priceToday || 0}</div>
                <small>Per ${material.unit || 'piece'}</small>
            </div>
        </div>
    `).join('');
}

// Display materials in table view
function displayTableView(filteredMaterials) {
    const inventoryGrid = document.getElementById('inventory-grid');
    const inventoryTable = document.getElementById('inventory-table');
    const tableBody = document.getElementById('inventory-table-body');
    
    inventoryGrid.style.display = 'none';
    inventoryTable.style.display = 'block';
    
    if (filteredMaterials.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 3rem; color: #64748b;">
                    <i class="fas fa-boxes" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <div>No inventory found</div>
                    <small>Upload your first file or add items manually to get started.</small>
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = filteredMaterials.map(material => `
        <tr>
            <td>
                <strong>${material.material}</strong>
                <br><small>${material.specs || 'No specifications'}</small>
            </td>
            <td>${material.brand || 'Generic'}</td>
            <td><span class="item-category">${material.category || 'Other'}</span></td>
            <td>${material.qty || material.quantity} ${material.unit || 'pcs'}</td>
            <td>$${material.price_today || material.priceToday || 0}</td>
            <td>${getProjectName(material.project_id || material.projectId)}</td>
            <td><span class="status-badge status-${material.listing_type || material.listingType || 'resale'}">${getStatusText(material.listing_type || material.listingType)}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn primary" onclick="showListingActionModal('${material.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Helper functions
function getProjectName(projectId) {
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : 'Default Project';
}

function getStatusText(listingType) {
    switch (listingType) {
        case 'resale': return 'For Sale';
        case 'internal_transfer': return 'Transfer';
        case 'sold': return 'Sold';
        default: return 'For Sale';
    }
}

// Set view (grid or table)
function setView(view) {
    currentView = view;
    
    // Update button states
    document.getElementById('grid-view-btn').classList.toggle('active', view === 'grid');
    document.getElementById('table-view-btn').classList.toggle('active', view === 'table');
    
    displayInventory();
}

// Toggle dropdown menu
function toggleDropdown(materialId) {
    const dropdown = document.getElementById(`dropdown-${materialId}`);
    
    // Close all other dropdowns
    document.querySelectorAll('.dropdown-content').forEach(d => {
        if (d.id !== `dropdown-${materialId}`) {
            d.classList.remove('show');
        }
    });
    
    dropdown.classList.toggle('show');
}

// Update listing type directly
async function updateListingType(materialId, listingType) {
    try {
        const response = await fetch(`/api/materials/${materialId}/listing-type`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ listingType })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`Listing updated to ${getStatusText(listingType)}`, 'success');
            loadInventory(); // Refresh inventory
        } else {
            showNotification('Error updating listing', 'error');
        }
    } catch (error) {
        showNotification('Error updating listing', 'error');
        console.error('Update listing error:', error);
    }
    
    // Close dropdown
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
}

// Show listing action modal
function showListingActionModal(materialId, listingType = null) {
    const modal = document.getElementById('listing-action-modal');
    const materialIdInput = document.getElementById('action-material-id');
    const listingTypeSelect = document.getElementById('listing-type');
    const targetProjectGroup = document.getElementById('target-project-group');
    
    materialIdInput.value = materialId;
    
    if (listingType) {
        listingTypeSelect.value = listingType;
        targetProjectGroup.style.display = listingType === 'internal_transfer' ? 'block' : 'none';
    }
    
    modal.classList.add('show');
    
    // Close dropdown
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
}

// Close listing action modal
function closeListingActionModal() {
    document.getElementById('listing-action-modal').classList.remove('show');
}

// Show create project modal
function showCreateProjectModal() {
    document.getElementById('project-modal').classList.add('show');
}

// Close project modal
function closeProjectModal() {
    document.getElementById('project-modal').classList.remove('show');
    document.getElementById('project-form').reset();
}

// Update dashboard statistics
function updateStats() {
    const totalItems = materials.reduce((sum, material) => 
        sum + (material.qty || material.quantity || 0), 0
    );
    const totalValue = materials.reduce((sum, material) => 
        sum + ((material.price_today || material.priceToday || 0) * (material.qty || material.quantity || 0)), 0
    );
    const activeListings = materials.filter(material => 
        (material.qty || material.quantity) > 0 && 
        (material.listing_type || material.listingType) === 'resale'
    ).length;
    
    document.getElementById('total-items').textContent = totalItems;
    document.getElementById('total-value').textContent = `$${totalValue.toFixed(2)}`;
    document.getElementById('active-listings').textContent = activeListings;
}

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const buttonText = e.target.closest('.tab-btn').textContent;
            let tabId;
            
            if (buttonText.includes('Upload')) {
                tabId = 'upload-tab';
            } else if (buttonText.includes('Inventory')) {
                tabId = 'inventory-tab';
            } else if (buttonText.includes('Add Single')) {
                tabId = 'manual-tab';
            } else if (buttonText.includes('Notifications')) {
                tabId = 'notifications-tab';
            } else {
                tabId = 'manual-tab'; // fallback
            }
            
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
        uploadBtn.addEventListener('click', uploadFile);
    }
    
    // Forms
    const manualForm = document.getElementById('manual-item-form');
    if (manualForm) {
        manualForm.addEventListener('submit', addManualItem);
    }
    
    const projectForm = document.getElementById('project-form');
    if (projectForm) {
        projectForm.addEventListener('submit', createProject);
    }
    
    const listingActionForm = document.getElementById('listing-action-form');
    if (listingActionForm) {
        listingActionForm.addEventListener('submit', handleListingAction);
    }
    
    // Search and filters
    const searchInput = document.getElementById('search-inventory');
    if (searchInput) {
        searchInput.addEventListener('input', displayInventory);
    }
    
    ['project-filter', 'category-filter', 'inventory-type-filter', 'listing-type-filter'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', loadInventory);
        }
    });
    
    // Listing type change handler
    const listingTypeSelect = document.getElementById('listing-type');
    if (listingTypeSelect) {
        listingTypeSelect.addEventListener('change', function() {
            const targetProjectGroup = document.getElementById('target-project-group');
            targetProjectGroup.style.display = this.value === 'internal_transfer' ? 'block' : 'none';
        });
    }
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
        }
    });
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
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // Add active class to corresponding button
    const buttons = document.querySelectorAll('.tab-btn');
    if (tabId === 'upload-tab' && buttons[0]) buttons[0].classList.add('active');
    else if (tabId === 'inventory-tab' && buttons[1]) buttons[1].classList.add('active');
    else if (tabId === 'manual-tab' && buttons[2]) buttons[2].classList.add('active');
    else if (tabId === 'notifications-tab' && buttons[3]) buttons[3].classList.add('active');
}

// File handling functions (enhanced for multiple formats)
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
    if (files.length > 0) {
        const file = files[0];
        if (isValidFileType(file)) {
            document.getElementById('csv-file').files = files;
            handleFileSelect();
        } else {
            showNotification('Please upload CSV, Excel (.xlsx/.xls), PDF, or ZIP files only', 'error');
        }
    }
}

function isValidFileType(file) {
    const validExtensions = ['.csv', '.xlsx', '.xls', '.pdf', '.zip'];
    const validMimeTypes = [
        'text/csv',
        'application/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/pdf',
        'application/zip',
        'application/x-zip-compressed'
    ];
    
    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    const hasValidMimeType = validMimeTypes.includes(file.type);
    
    return hasValidExtension || hasValidMimeType;
}

function getFileTypeDisplay(file) {
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.csv')) return 'CSV';
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) return 'Excel';
    if (fileName.endsWith('.pdf')) return 'PDF';
    if (fileName.endsWith('.zip')) return 'ZIP';
    return 'File';
}

function handleFileSelect() {
    const fileInput = document.getElementById('csv-file');
    const uploadBtn = document.getElementById('upload-btn');
    const uploadArea = document.getElementById('upload-area');
    
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileType = getFileTypeDisplay(file);
        const fileSize = (file.size / 1024 / 1024).toFixed(2); // MB
        
        uploadArea.innerHTML = `
            <div class="upload-content">
                <i class="fas fa-file-${fileType.toLowerCase() === 'csv' ? 'csv' : fileType.toLowerCase() === 'excel' ? 'excel' : 'pdf'}"></i>
                <h3>${file.name}</h3>
                <p>${fileType} file (${fileSize} MB)</p>
                <p>Ready to upload</p>
            </div>
        `;
        uploadBtn.disabled = false;
    }
}

// Enhanced file upload function supporting CSV, Excel, and PDF
async function uploadFile() {
    const fileInput = document.getElementById('csv-file');
    const currentProject = document.getElementById('current-project');
    const uploadProgress = document.getElementById('upload-progress');
    const uploadBtn = document.getElementById('upload-btn');
    
    if (!fileInput.files.length) {
        showNotification('Please select a file', 'error');
        return;
    }
    
    const selectedProject = currentProject.value;
    if (!selectedProject) {
        showNotification('Please select a project first', 'error');
        return;
    }
    
    const file = fileInput.files[0];
    
    // Validate file type
    if (!isValidFileType(file)) {
        showNotification('Please upload CSV, Excel (.xlsx/.xls), PDF, or ZIP files only', 'error');
        return;
    }
    
    // Check file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
        showNotification('File size must be less than 50MB', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sellerId', currentUser.id);
    formData.append('projectId', selectedProject);
    
    uploadBtn.disabled = true;
    uploadProgress.style.display = 'block';
    
    const fileType = getFileTypeDisplay(file);
    
    try {
        const response = await fetch('/api/upload-file', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            if (result.partialSuccess) {
                // Some items failed but some succeeded
                showNotification(
                    `${result.message}\n\nSuccessful: ${result.count}\nFailed: ${result.failedRows}\n\nFirst few errors:\n${result.errors.slice(0, 3).join('\n')}`, 
                    'warning'
                );
            } else {
                // All items succeeded
                showNotification(result.message, 'success');
            }
            
            loadInventory(); // Refresh inventory
            
            // Reset upload form
            fileInput.value = '';
            document.getElementById('upload-area').innerHTML = `
                <div class="upload-content">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <h3>Drop your file here</h3>
                    <p>Supports CSV, Excel (.xlsx/.xls), and PDF files</p>
                    <p>or <span class="upload-link">click to browse</span></p>
                </div>
            `;
        } else {
            // Upload failed
            if (result.errors && result.errors.length > 0) {
                let errorMessage = result.message + ':\n\n' + result.errors.slice(0, 5).join('\n');
                if (result.errors.length > 5) {
                    errorMessage += `\n... and ${result.errors.length - 5} more errors`;
                }
                showNotification(errorMessage, 'error');
            } else {
                showNotification(result.message || `Error uploading ${fileType} file`, 'error');
            }
        }
    } catch (error) {
        showNotification(`Error uploading ${fileType} file`, 'error');
        console.error('Upload error:', error);
    } finally {
        uploadBtn.disabled = false;
        uploadProgress.style.display = 'none';
    }
}

// Create new project
async function createProject(e) {
    e.preventDefault();
    
    const projectData = {
        sellerId: currentUser.id,
        name: document.getElementById('project-name').value,
        location: document.getElementById('project-location').value,
        description: document.getElementById('project-description').value
    };
    
    try {
        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(projectData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Project created successfully', 'success');
            closeProjectModal();
            loadProjects(); // Refresh projects
        } else {
            showNotification('Error creating project', 'error');
        }
    } catch (error) {
        showNotification('Error creating project', 'error');
        console.error('Create project error:', error);
    }
}

// Handle listing action form submission
async function handleListingAction(e) {
    e.preventDefault();
    
    const materialId = document.getElementById('action-material-id').value;
    const listingType = document.getElementById('listing-type').value;
    const targetProjectId = document.getElementById('target-project').value;
    
    try {
        const response = await fetch(`/api/materials/${materialId}/listing-type`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ listingType, targetProjectId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`Listing updated to ${getStatusText(listingType)}`, 'success');
            closeListingActionModal();
            loadInventory(); // Refresh inventory
        } else {
            showNotification('Error updating listing', 'error');
        }
    } catch (error) {
        showNotification('Error updating listing', 'error');
        console.error('Update listing error:', error);
    }
}

// Add manual item (enhanced with project selection)
async function addManualItem(e) {
    e.preventDefault();
    
    const currentProject = document.getElementById('current-project');
    const selectedProject = currentProject.value;
    
    if (!selectedProject) {
        showNotification('Please select a project first', 'error');
        return;
    }
    
    const material = {
        sellerId: currentUser.id,
        projectId: selectedProject,
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
        inventoryType: 'manual',
        listingType: 'resale'
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

// Show notification with enhanced styling
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    
    // Handle multiline messages
    if (message.includes('\n')) {
        notification.innerHTML = message.replace(/\n/g, '<br>');
    } else {
        notification.textContent = message;
    }
    
    notification.className = `notification ${type} show`;
    
    // Auto-hide after delay (longer for warnings/errors)
    const delay = type === 'error' || type === 'warning' ? 8000 : 5000;
    setTimeout(() => {
        notification.classList.remove('show');
    }, delay);
}

// Notification system
let notifications = [];

async function loadNotifications() {
    try {
        const response = await fetch(`/api/notifications/${currentUser.id}`);
        if (response.ok) {
            const result = await response.json();
            notifications = result.notifications || [];
        } else {
            // Fallback to localStorage
            const savedNotifications = localStorage.getItem(`greenscore-notifications-${currentUser.id}`);
            notifications = savedNotifications ? JSON.parse(savedNotifications) : [];
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
        // Fallback to localStorage
        const savedNotifications = localStorage.getItem(`greenscore-notifications-${currentUser.id}`);
        notifications = savedNotifications ? JSON.parse(savedNotifications) : [];
    }
    
    updateNotificationDisplay();
    updateNotificationBadge();
}

function updateNotificationBadge() {
    const unreadCount = notifications.filter(n => !n.read).length;
    const badge = document.getElementById('notification-count');
    
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
    }
}

function updateNotificationDisplay() {
    const container = document.getElementById('notifications-list');
    if (!container) return;
    
    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="no-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications</p>
                <small>Sales notifications will appear here when buyers purchase your items</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = notifications.map(notification => `
        <div class="notification-item ${!notification.read ? 'unread' : ''}" onclick="markNotificationRead('${notification.id}')">
            <div class="notification-icon">
                <i class="fas ${getNotificationIcon(notification.type)}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${notification.title}</div>
                <div class="notification-message">${notification.message}</div>
                <div class="notification-time">${formatNotificationTime(notification.created_at || notification.timestamp)}</div>
                ${notification.read ? '' : '<div class="notification-status">New</div>'}
            </div>
        </div>
    `).join('');
}

function getNotificationIcon(type) {
    switch (type) {
        case 'sale': return 'fa-rupee-sign';
        case 'transfer': return 'fa-exchange-alt';
        case 'system': return 'fa-info-circle';
        default: return 'fa-bell';
    }
}

function formatNotificationTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

async function markNotificationRead(notificationId) {
    try {
        const response = await fetch(`/api/notifications/${notificationId}/read`, {
            method: 'PUT'
        });
        
        if (response.ok) {
            const notification = notifications.find(n => n.id === notificationId);
            if (notification) {
                notification.read = true;
                updateNotificationDisplay();
                updateNotificationBadge();
            }
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function markAllNotificationsRead() {
    try {
        const response = await fetch(`/api/notifications/${currentUser.id}/mark-all-read`, {
            method: 'PUT'
        });
        
        if (response.ok) {
            notifications.forEach(n => n.read = true);
            updateNotificationDisplay();
            updateNotificationBadge();
        }
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

function clearAllNotifications() {
    notifications = [];
    localStorage.removeItem(`greenscore-notifications-${currentUser.id}`);
    updateNotificationDisplay();
    updateNotificationBadge();
}

// Make functions globally available
window.showTab = showTab;
window.setView = setView;
window.toggleDropdown = toggleDropdown;
window.updateListingType = updateListingType;
window.showListingActionModal = showListingActionModal;
window.closeListingActionModal = closeListingActionModal;
window.showCreateProjectModal = showCreateProjectModal;
window.closeProjectModal = closeProjectModal;
window.signOut = signOut;
window.markAllNotificationsRead = markAllNotificationsRead;
window.clearAllNotifications = clearAllNotifications;
window.markNotificationRead = markNotificationRead;
