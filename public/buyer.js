// Buyer Marketplace JavaScript

let currentUser = null;
let materials = [];
let categories = [];
let cart = [];
let filteredMaterials = [];
let notifications = [];

// Initialize the buyer marketplace
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication - but allow guest browsing
    currentUser = getCurrentUser();
    
    // Update welcome message if user is signed in
    if (currentUser) {
        document.getElementById('buyer-welcome').textContent = 
            `Welcome, ${currentUser.name}! Find quality surplus construction materials at competitive prices`;
    }
    
    loadCategories();
    loadMaterials();
    setupEventListeners();
    loadCart();
    loadNotifications();
    
    // Set up auto-refresh system
    setupAutoRefresh();
    
    // Set up periodic refresh for notifications
    setInterval(() => {
        loadNotifications();
    }, 30000); // Check every 30 seconds
    
    // Close notifications dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('notifications-dropdown');
        const notificationBtn = e.target.closest('.notification-btn');
        if (dropdown && dropdown.style.display !== 'none' && !dropdown.contains(e.target) && !notificationBtn) {
            dropdown.style.display = 'none';
        }
    });
});

// Authentication functions
function getCurrentUser() {
    const userStr = localStorage.getItem('greenscore-user');
    return userStr ? JSON.parse(userStr) : null;
}

function signOut() {
    localStorage.removeItem('greenscore-user');
    localStorage.removeItem('greenscore-cart'); // Clear cart on sign out
    window.location.href = '/';
}

// Load categories from API
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        categories = await response.json();
        
        populateCategoryFilters();
        displayCategories();
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Load materials from API
async function loadMaterials() {
    try {
        const response = await fetch('/api/materials');
        materials = await response.json();
        
        filteredMaterials = [...materials];
        displayMaterials();
        updateCategoryCounts();
    } catch (error) {
        console.error('Error loading materials:', error);
        document.getElementById('products-grid').innerHTML = `
            <div class="no-products">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error loading materials</h3>
                <p>Please try refreshing the page.</p>
            </div>
        `;
    }
}

// Populate category filters
function populateCategoryFilters() {
    const categoryFilter = document.getElementById('category-filter');
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
}

// Display categories in sidebar
function displayCategories() {
    const categoryList = document.getElementById('category-list');
    
    const allCategory = document.createElement('div');
    allCategory.className = 'category-item active';
    allCategory.innerHTML = `
        <span>All Categories</span>
        <span class="category-count">${materials.length}</span>
    `;
    allCategory.addEventListener('click', () => selectCategory('all'));
    categoryList.appendChild(allCategory);
    
    categories.forEach(category => {
        const categoryItem = document.createElement('div');
        categoryItem.className = 'category-item';
        categoryItem.innerHTML = `
            <span>${category}</span>
            <span class="category-count">0</span>
        `;
        categoryItem.addEventListener('click', () => selectCategory(category));
        categoryList.appendChild(categoryItem);
    });
}

// Update category counts
function updateCategoryCounts() {
    const categoryItems = document.querySelectorAll('.category-item');
    
    categoryItems.forEach((item, index) => {
        if (index === 0) {
            // All categories
            item.querySelector('.category-count').textContent = materials.length;
        } else {
            const category = categories[index - 1];
            const count = materials.filter(material => material.category === category).length;
            item.querySelector('.category-count').textContent = count;
        }
    });
}

// Select category
function selectCategory(category) {
    // Update active category
    document.querySelectorAll('.category-item').forEach(item => {
        item.classList.remove('active');
    });
    
    event.target.closest('.category-item').classList.add('active');
    
    // Update filter and reload materials
    document.getElementById('category-filter').value = category === 'all' ? 'all' : category;
    filterMaterials();
}

// Display materials in grid
function displayMaterials() {
    const productsGrid = document.getElementById('products-grid');
    const productsTitle = document.getElementById('products-title');
    const productsCount = document.getElementById('products-count');
    
    if (filteredMaterials.length === 0) {
        productsGrid.innerHTML = `
            <div class="no-products">
                <i class="fas fa-search"></i>
                <h3>No materials found</h3>
                <p>Try adjusting your search criteria or browse different categories.</p>
            </div>
        `;
        productsCount.textContent = '0 items found';
        return;
    }
    
    productsCount.textContent = `${filteredMaterials.length} items found`;
    
    // Check if current user is admin
    const isAdmin = currentUser && currentUser.userType === 'admin';
    
    productsGrid.innerHTML = filteredMaterials.map(material => `
        <div class="product-card" onclick="${material.is_being_edited ? '' : `showProductModal('${material.id}')`}" style="position: relative; ${material.is_being_edited ? 'opacity: 0.7; cursor: not-allowed;' : ''}">
            ${material.is_being_edited ? `
                <div style="position: absolute; top: 10px; left: 10px; background: #ef4444; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; z-index: 10;">
                    <i class="fas fa-lock"></i> Being Edited
                </div>
            ` : ''}
            ${isAdmin && !material.is_being_edited ? `
                <div class="admin-delete-btn" onclick="event.stopPropagation(); deleteMaterial('${material.id}')" title="Delete Material" style="position: absolute; top: 10px; right: 10px; background: #ef4444; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                    <i class="fas fa-trash" style="font-size: 14px;"></i>
                </div>
            ` : ''}
            <div class="product-image">
                ${material.photo ? 
                    `<img src="${material.photo}" alt="${material.material}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                     <div style="display:none; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#9ca3af;">
                         <i class="fas fa-image" style="font-size:2rem; margin-bottom:0.5rem;"></i>
                         <span>No Image</span>
                     </div>` :
                    `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#9ca3af;">
                         <i class="fas fa-image" style="font-size:2rem; margin-bottom:0.5rem;"></i>
                         <span>No Image</span>
                     </div>`
                }
            </div>
            <div class="product-info">
                <div class="product-header">
                    <span class="product-category">${material.category || 'Other'}</span>
                </div>
                <h3>${material.material}</h3>
                <div class="product-brand">${material.brand || 'Generic'}</div>
                <div class="product-specs">${material.specs || 'No specifications available'}</div>
                <div class="product-meta">
                    <span><strong>Condition:</strong> ${material.condition || 'N/A'}</span>
                    <span><strong>Available:</strong> ${material.qty} ${material.unit || 'pcs'}</span>
                </div>
                <div class="product-footer">
                    <div class="product-price">₹${material.priceToday || 0}</div>
                    ${getCartButtonHTML(material)}
                </div>
            </div>
        </div>
    `).join('');
}

// Get cart button HTML based on whether item is in cart
function getCartButtonHTML(material) {
    const materialId = material.id;
    const maxQty = material.qty;
    const sellerId = material.seller_id || material.sellerId;
    
    // Check if item is being edited
    if (material.is_being_edited) {
        return `
            <div class="locked-item-notice" style="background: #fef2f2; color: #dc2626; padding: 8px; border-radius: 4px; text-align: center;">
                <i class="fas fa-lock"></i>
                Being Updated
            </div>
        `;
    }
    
    // Prevent self-buying
    if (currentUser && currentUser.id === sellerId) {
        return `
            <div class="self-item-notice">
                <i class="fas fa-info-circle"></i>
                Your Item
            </div>
        `;
    }
    
    const cartItem = cart.find(item => item.materialId === materialId);
    
    if (cartItem) {
        // Item is in cart - show quantity controls with input field
        return `
            <div class="cart-quantity-controls-enhanced">
                <button class="qty-btn minus" onclick="event.stopPropagation(); updateCartQuantity('${materialId}', -1)" title="Decrease quantity">
                    <i class="fas fa-minus"></i>
                </button>
                <input type="number" 
                       class="qty-input" 
                       value="${cartItem.quantity}" 
                       min="1" 
                       max="${maxQty}" 
                       onclick="event.stopPropagation();"
                       onchange="event.stopPropagation(); setCartQuantity('${materialId}', this.value, ${maxQty})"
                       onkeypress="event.stopPropagation();"
                       title="Type quantity or use arrows">
                <button class="qty-btn plus" onclick="event.stopPropagation(); updateCartQuantity('${materialId}', 1)" ${cartItem.quantity >= maxQty ? 'disabled' : ''} title="Increase quantity">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
        `;
    } else {
        // Item not in cart - show add button with quantity selector
        return `
            <div class="add-to-cart-container">
                <div class="qty-selector">
                    <input type="number" 
                           id="qty-select-${materialId}"
                           class="qty-input-small" 
                           value="1" 
                           min="1" 
                           max="${maxQty}"
                           onclick="event.stopPropagation();"
                           onkeypress="event.stopPropagation();"
                           placeholder="Qty">
                    <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCartWithQty('${materialId}', ${maxQty})">
                        <i class="fas fa-cart-plus"></i>
                        Add to Cart
                    </button>
                </div>
            </div>
        `;
    }
}

// Filter materials
function filterMaterials() {
    const categoryFilter = document.getElementById('category-filter').value;
    const conditionFilter = document.getElementById('condition-filter').value;
    const sortFilter = document.getElementById('sort-filter').value;
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    
    filteredMaterials = [...materials];
    
    // Filter by category
    if (categoryFilter && categoryFilter !== 'all') {
        filteredMaterials = filteredMaterials.filter(material => 
            material.category === categoryFilter
        );
    }
    
    // Filter by condition
    if (conditionFilter && conditionFilter !== 'all') {
        filteredMaterials = filteredMaterials.filter(material => 
            material.condition === conditionFilter
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
    
    // Sort materials
    switch (sortFilter) {
        case 'price-low':
            filteredMaterials.sort((a, b) => (a.priceToday || 0) - (b.priceToday || 0));
            break;
        case 'price-high':
            filteredMaterials.sort((a, b) => (b.priceToday || 0) - (a.priceToday || 0));
            break;
        case 'newest':
        default:
            filteredMaterials.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            break;
    }
    
    displayMaterials();
}

// Setup event listeners
function setupEventListeners() {
    // Search and filters
    document.getElementById('search-input').addEventListener('input', filterMaterials);
    document.getElementById('category-filter').addEventListener('change', filterMaterials);
    document.getElementById('condition-filter').addEventListener('change', filterMaterials);
    document.getElementById('sort-filter').addEventListener('change', filterMaterials);
    
    // Checkout form
    document.getElementById('checkout-form').addEventListener('submit', placeOrder);
    
    // Modal close events
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeModal();
            closeCheckoutModal();
        }
    });
}

// Delete material (admin only)
async function deleteMaterial(materialId) {
    // Check if user is admin
    if (!currentUser || currentUser.userType !== 'admin') {
        showNotification('Admin access required to delete materials', 'error');
        return;
    }
    
    const material = materials.find(m => m.id === materialId);
    if (!material) {
        showNotification('Material not found', 'error');
        return;
    }
    
    const confirmed = confirm(`Are you sure you want to delete "${material.material}"? This action cannot be undone.`);
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/admin/materials/${materialId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`Material "${material.material}" deleted successfully`, 'success');
            // Remove material from local array
            materials = materials.filter(m => m.id !== materialId);
            filteredMaterials = filteredMaterials.filter(m => m.id !== materialId);
            // Refresh display
            displayMaterials();
            updateCategoryCounts();
        } else {
            showNotification(result.error || 'Failed to delete material', 'error');
        }
    } catch (error) {
        console.error('Error deleting material:', error);
        showNotification('Failed to delete material', 'error');
    }
}

// Show product modal
function showProductModal(materialId) {
    const material = materials.find(m => m.id === materialId);
    if (!material) return;
    
    // Check if material is being edited
    if (material.is_being_edited) {
        showNotification('This item is currently being updated and cannot be viewed.', 'error');
        return;
    }
    
    const modal = document.getElementById('product-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    // Check if current user is admin
    const isAdmin = currentUser && currentUser.userType === 'admin';
    
    modalTitle.textContent = material.material;
    modalBody.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
            <div>
                <div class="product-image" style="height: 250px; border-radius: 0.5rem; overflow: hidden;">
                    ${material.photo ? 
                        `<img src="${material.photo}" alt="${material.material}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                         <div style="display:none; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#9ca3af; background:#f3f4f6;">
                             <i class="fas fa-image" style="font-size:3rem; margin-bottom:1rem;"></i>
                             <span>No Image Available</span>
                         </div>` :
                        `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#9ca3af; background:#f3f4f6;">
                             <i class="fas fa-image" style="font-size:3rem; margin-bottom:1rem;"></i>
                             <span>No Image Available</span>
                         </div>`
                    }
                </div>
                ${isAdmin ? `
                    <div style="margin-top: 1rem;">
                        <button class="btn btn-danger" onclick="closeModal(); deleteMaterial('${material.id}')" style="width: 100%; background: #ef4444; color: white; padding: 0.75rem; border-radius: 0.5rem; border: none; cursor: pointer; font-weight: 500;">
                            <i class="fas fa-trash"></i> Delete Material (Admin)
                        </button>
                    </div>
                ` : ''}
            </div>
            <div>
                <div style="margin-bottom: 1rem;">
                    <span class="product-category">${material.category || 'Other'}</span>
                </div>
                <h3 style="font-size: 1.5rem; margin-bottom: 1rem;">${material.material}</h3>
                <div style="margin-bottom: 1rem;"><strong>Brand:</strong> ${material.brand || 'Generic'}</div>
                <div style="margin-bottom: 1rem;"><strong>Condition:</strong> ${material.condition || 'N/A'}</div>
                <div style="margin-bottom: 1rem;"><strong>Available Quantity:</strong> ${material.qty} ${material.unit || 'pcs'}</div>
                <div style="margin-bottom: 2rem;"><strong>Price:</strong> <span style="font-size: 1.5rem; color: #10b981; font-weight: bold;">₹${material.priceToday || 0}</span> per ${material.unit || 'piece'}</div>
                ${!isAdmin ? `
                    <button class="btn btn-primary" onclick="addToCart('${material.id}'); closeModal();" style="width: 100%;">
                        <i class="fas fa-cart-plus"></i>
                        Add to Cart
                    </button>
                ` : ''}
            </div>
        </div>
        <div>
            <h4 style="margin-bottom: 1rem;">Specifications</h4>
            <p style="line-height: 1.6; color: #64748b;">${material.specs || 'No specifications available for this item.'}</p>
        </div>
    `;
    
    modal.classList.add('show');
}

// Close product modal
function closeModal() {
    document.getElementById('product-modal').classList.remove('show');
}

// Add to cart
function addToCart(materialId) {
    const material = materials.find(m => m.id === materialId);
    if (!material) return;
    
    // Check if material is being edited
    if (material.is_being_edited) {
        showNotification('This item is currently being updated. Please try again later.', 'error');
        return;
    }
    
    const existingItem = cart.find(item => item.materialId === materialId);
    
    if (existingItem) {
        if (existingItem.quantity < material.qty) {
            existingItem.quantity += 1;
        } else {
            showNotification('Maximum available quantity reached', 'error');
            return;
        }
    } else {
        cart.push({
            materialId: materialId,
            material: material.material,
            brand: material.brand,
            price: material.priceToday || 0,
            unit: material.unit || 'pcs',
            maxQty: material.qty,
            quantity: 1,
            sellerId: material.sellerId  // Add seller ID for grouping
        });
    }
    
    updateCartDisplay();
    displayMaterials(); // Refresh product display to show quantity controls
    saveCart();
    showNotification('Item added to cart', 'success');
}

// Add to cart with specified quantity
function addToCartWithQty(materialId, maxQty) {
    const material = materials.find(m => m.id === materialId);
    if (!material) return;
    
    // Check if material is being edited
    if (material.is_being_edited) {
        showNotification('This item is currently being updated. Please try again later.', 'error');
        return;
    }
    
    const qtyInput = document.getElementById(`qty-select-${materialId}`);
    const quantity = parseInt(qtyInput.value) || 1;
    
    if (quantity < 1) {
        showNotification('Please enter a valid quantity', 'error');
        return;
    }
    
    if (quantity > maxQty) {
        showNotification(`Maximum available quantity is ${maxQty}`, 'error');
        qtyInput.value = maxQty;
        return;
    }
    
    const existingItem = cart.find(item => item.materialId === materialId);
    
    if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (newQuantity > material.qty) {
            showNotification(`Can only add ${material.qty - existingItem.quantity} more items`, 'error');
            return;
        }
        existingItem.quantity = newQuantity;
    } else {
        cart.push({
            materialId: materialId,
            material: material.material,
            brand: material.brand,
            price: material.priceToday || 0,
            unit: material.unit || 'pcs',
            maxQty: material.qty,
            quantity: quantity,
            sellerId: material.sellerId
        });
    }
    
    updateCartDisplay();
    displayMaterials(); // Refresh product display to show quantity controls
    saveCart();
    showNotification(`Added ${quantity} ${material.unit || 'item(s)'} to cart`, 'success');
}

// Set cart quantity directly from input
function setCartQuantity(materialId, value, maxQty) {
    const quantity = parseInt(value) || 1;
    
    if (quantity < 1) {
        removeFromCart(materialId);
        return;
    }
    
    if (quantity > maxQty) {
        showNotification(`Maximum available quantity is ${maxQty}`, 'error');
        // Reset the input to max value
        const inputs = document.querySelectorAll('.qty-input');
        inputs.forEach(input => {
            if (input.onchange && input.onchange.toString().includes(materialId)) {
                input.value = maxQty;
            }
        });
        updateCartQuantity(materialId, maxQty - cart.find(item => item.materialId === materialId).quantity);
        return;
    }
    
    const item = cart.find(item => item.materialId === materialId);
    if (item) {
        item.quantity = quantity;
        updateCartDisplay();
        displayMaterials();
        saveCart();
    }
}

// Update cart display
function updateCartDisplay() {
    const cartCount = document.getElementById('cart-count');
    const cartItems = document.getElementById('cart-items');
    const cartSubtotal = document.getElementById('cart-subtotal');
    const cartPlatformFee = document.getElementById('cart-platform-fee');
    const cartTotal = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');
    
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
    
    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-cart"></i>
                <p>Your cart is empty</p>
                <small>Add some materials to get started</small>
            </div>
        `;
        checkoutBtn.disabled = true;
    } else {
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <h4>${item.material}</h4>
                    <div class="cart-item-meta">${item.brand || 'Generic'} • ₹${item.price} per ${item.unit}</div>
                    <div class="cart-item-controls">
                        <div class="qty-control-enhanced">
                            <button class="qty-btn-cart" onclick="updateCartQuantity('${item.materialId}', -1)" title="Decrease">
                                <i class="fas fa-minus"></i>
                            </button>
                            <input type="number" 
                                   class="qty-input-cart" 
                                   value="${item.quantity}" 
                                   min="1" 
                                   max="${item.maxQty}"
                                   onchange="setCartQuantity('${item.materialId}', this.value, ${item.maxQty})"
                                   title="Type quantity">
                            <button class="qty-btn-cart" onclick="updateCartQuantity('${item.materialId}', 1)" ${item.quantity >= item.maxQty ? 'disabled' : ''} title="Increase">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                        <button class="remove-item" onclick="removeFromCart('${item.materialId}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="cart-item-price">${formatIndianCurrency(item.price * item.quantity)}</div>
            </div>
        `).join('');
        checkoutBtn.disabled = false;
    }
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const platformFee = subtotal * 0.03; // 3% platform fee
    const total = subtotal + platformFee;
    
    cartSubtotal.textContent = formatIndianCurrency(subtotal);
    cartPlatformFee.textContent = formatIndianCurrency(platformFee);
    cartTotal.textContent = formatIndianCurrency(total);
}

// Update cart item quantity
function updateCartQuantity(materialId, change) {
    const item = cart.find(item => item.materialId === materialId);
    if (!item) return;
    
    const newQuantity = item.quantity + change;
    
    if (newQuantity <= 0) {
        removeFromCart(materialId);
        return;
    }
    
    if (newQuantity > item.maxQty) {
        showNotification('Maximum available quantity reached', 'error');
        return;
    }
    
    item.quantity = newQuantity;
    updateCartDisplay();
    displayMaterials(); // Refresh product display to update quantity controls
    saveCart();
}

// Remove from cart
function removeFromCart(materialId) {
    cart = cart.filter(item => item.materialId !== materialId);
    updateCartDisplay();
    displayMaterials(); // Refresh product display to show add button again
    saveCart();
    showNotification('Item removed from cart', 'success');
}

// Clear cart
function clearCart() {
    cart = [];
    updateCartDisplay();
    saveCart();
    showNotification('Cart cleared', 'success');
}

// Toggle cart sidebar
function toggleCart() {
    const cartSidebar = document.getElementById('cart-sidebar');
    cartSidebar.classList.toggle('open');
}

// Checkout
function checkout() {
    if (cart.length === 0) {
        showNotification('Your cart is empty', 'error');
        return;
    }
    
    // Check if user is logged in for checkout
    if (!currentUser) {
        showNotification('Please sign in to complete your purchase', 'error');
        setTimeout(() => {
            window.location.href = '/auth.html';
        }, 2000);
        return;
    }
    
    const modal = document.getElementById('checkout-modal');
    const checkoutItems = document.getElementById('checkout-items');
    const checkoutSubtotal = document.getElementById('checkout-subtotal');
    const checkoutPlatformFee = document.getElementById('checkout-platform-fee');
    const checkoutTotal = document.getElementById('checkout-total');
    
    // Populate checkout items
    checkoutItems.innerHTML = cart.map(item => `
        <div class="checkout-item">
            <div>
                <strong>${item.material}</strong><br>
                <small>${item.brand || 'Generic'} • ${item.quantity} ${item.unit} × ₹${item.price}</small>
            </div>
            <div>${formatIndianCurrency(item.price * item.quantity)}</div>
        </div>
    `).join('');
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const platformFee = subtotal * 0.03;
    const total = subtotal + platformFee;
    
    checkoutSubtotal.textContent = formatIndianCurrency(subtotal);
    checkoutPlatformFee.textContent = formatIndianCurrency(platformFee);
    checkoutTotal.textContent = formatIndianCurrency(total);
    
    modal.classList.add('show');
}

// Close checkout modal
function closeCheckoutModal() {
    document.getElementById('checkout-modal').classList.remove('show');
}

// Place order
async function placeOrder(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const buyerId = currentUser ? currentUser.id : 'guest-' + Date.now();
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const platformFee = subtotal * 0.03;
    const total = subtotal + platformFee;
    
    // Create individual order requests for each item
    const companyName = document.getElementById('company-name').value;
    const contactPerson = document.getElementById('contact-person').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const deliveryAddress = document.getElementById('delivery-address').value;
    
    try {
        // Generate a batch ID for grouping these orders
        const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Group items by seller
        const itemsBySeller = {};
        cart.forEach(item => {
            if (!itemsBySeller[item.sellerId]) {
                itemsBySeller[item.sellerId] = [];
            }
            itemsBySeller[item.sellerId].push(item);
        });
        
        const requestPromises = cart.map(item => {
            const requestData = {
                buyerId: buyerId,
                materialId: item.materialId,
                quantity: item.quantity,
                companyName,
                contactPerson,
                email,
                phone,
                deliveryAddress,
                deliveryNotes: `Order from ${companyName} for ${item.material}`,
                batchId: batchId  // Add batch ID to group orders
            };
            
            return fetch('/api/order-requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
        });
        
        const responses = await Promise.all(requestPromises);
        const results = await Promise.all(responses.map(r => r.json()));
        
        // Check if all requests were successful
        const allSuccessful = results.every(result => result.success);
        
        if (allSuccessful) {
            // Create consolidated notifications for each seller
            for (const [sellerId, items] of Object.entries(itemsBySeller)) {
                const sellerTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                
                await fetch('/api/order-requests/batch-notification', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        sellerId,
                        buyerId,
                        companyName,
                        items: items.map(item => ({
                            material: item.material,
                            quantity: item.quantity,
                            totalAmount: item.price * item.quantity
                        })),
                        totalAmount: sellerTotal
                    })
                });
            }
            
            showNotification(`${cart.length} order request(s) submitted successfully! Sellers will review and respond.`, 'success');
            
            // Clear cart and close modals
            cart = [];
            updateCartDisplay();
            saveCart();
            closeCheckoutModal();
            toggleCart();
            
            // Reload materials to update quantities
            loadMaterials();
        } else {
            const failedCount = results.filter(result => !result.success).length;
            showNotification(`${failedCount} order request(s) failed. Please try again.`, 'error');
        }
    } catch (error) {
        showNotification('Error placing order. Please try again.', 'error');
        console.error('Order error:', error);
    }
}

// Save cart to localStorage
function saveCart() {
    localStorage.setItem('greenscore-cart', JSON.stringify(cart));
}

// Load cart from localStorage
function loadCart() {
    const savedCart = localStorage.getItem('greenscore-cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartDisplay();
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

// Make functions global
window.toggleCart = toggleCart;
window.clearCart = clearCart;
window.setCartQuantity = setCartQuantity;
window.addToCartWithQty = addToCartWithQty;
// Auto-refresh system for buyer marketplace
let refreshInterval = null;
let isPageVisible = true;
let lastRefreshTime = Date.now();

function setupAutoRefresh() {
    console.log('🔄 Setting up buyer auto-refresh system...');
    
    // Refresh when page becomes visible (user switches back to tab)
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            isPageVisible = false;
            console.log('📱 Buyer page hidden - pausing auto-refresh');
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            }
        } else {
            isPageVisible = true;
            console.log('📱 Buyer page visible - resuming auto-refresh');
            
            // Refresh immediately if it's been more than 30 seconds
            const timeSinceLastRefresh = Date.now() - lastRefreshTime;
            if (timeSinceLastRefresh > 30000) {
                console.log('⏰ Refreshing marketplace after tab switch...');
                refreshMarketplace();
            }
            
            // Start periodic refresh
            startPeriodicRefresh();
        }
    });
    
    // Start initial periodic refresh
    startPeriodicRefresh();
}

function startPeriodicRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    // Refresh every 60 seconds when page is visible (less frequent for buyers)
    refreshInterval = setInterval(() => {
        if (isPageVisible) {
            console.log('🔄 Periodic marketplace refresh...');
            refreshMarketplace();
        }
    }, 60000);
    
    console.log('✅ Buyer periodic refresh started (60 second intervals)');
}

async function refreshMarketplace() {
    try {
        showRefreshIndicator(true);
        
        // Refresh materials and categories
        await Promise.all([
            loadMaterials(),
            loadCategories()
        ]);
        
        lastRefreshTime = Date.now();
        console.log('✅ Marketplace refresh completed');
        
        // Show brief success indicator
        setTimeout(() => showRefreshIndicator(false, 'success'), 500);
        
    } catch (error) {
        console.error('❌ Error refreshing marketplace:', error);
        showRefreshIndicator(false, 'error');
    }
}

function showRefreshIndicator(isLoading, status = null) {
    let indicator = document.getElementById('refresh-indicator');
    
    if (!indicator) {
        // Create refresh indicator if it doesn't exist
        indicator = document.createElement('div');
        indicator.id = 'refresh-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            z-index: 1000;
            transition: all 0.3s ease;
            transform: translateY(-100px);
            opacity: 0;
        `;
        document.body.appendChild(indicator);
    }
    
    if (isLoading) {
        indicator.innerHTML = '<i class="fas fa-sync fa-spin"></i> Updating...';
        indicator.style.background = '#6b7280';
        indicator.style.transform = 'translateY(0)';
        indicator.style.opacity = '1';
    } else if (status === 'success') {
        indicator.innerHTML = '<i class="fas fa-check"></i> Updated';
        indicator.style.background = '#10b981';
        indicator.style.transform = 'translateY(0)';
        indicator.style.opacity = '1';
        
        // Hide after 2 seconds
        setTimeout(() => {
            indicator.style.transform = 'translateY(-100px)';
            indicator.style.opacity = '0';
        }, 2000);
    } else if (status === 'error') {
        indicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
        indicator.style.background = '#ef4444';
        indicator.style.transform = 'translateY(0)';
        indicator.style.opacity = '1';
        
        // Hide after 3 seconds
        setTimeout(() => {
            indicator.style.transform = 'translateY(-100px)';
            indicator.style.opacity = '0';
        }, 3000);
    } else {
        indicator.style.transform = 'translateY(-100px)';
        indicator.style.opacity = '0';
    }
}

// Manual refresh function for buyers
function manualRefresh() {
    console.log('🔄 Manual marketplace refresh triggered');
    refreshMarketplace();
}

// Notifications system
async function loadNotifications() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/notifications/${currentUser.id}`);
        const data = await response.json();
        
        if (data.success) {
            notifications = data.notifications || [];
            updateNotificationBadge();
            displayNotifications();
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

function updateNotificationBadge() {
    const badge = document.getElementById('notification-badge');
    const unreadCount = notifications.filter(n => !n.read).length;
    
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

function displayNotifications() {
    const listContainer = document.getElementById('notifications-list');
    if (!listContainer) return;
    
    if (notifications.length === 0) {
        listContainer.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #6b7280;">
                <i class="fas fa-bell-slash" style="font-size: 48px; margin-bottom: 10px; opacity: 0.3;"></i>
                <p>No notifications yet</p>
            </div>
        `;
        return;
    }
    
    listContainer.innerHTML = notifications.map(notification => `
        <div class="notification-item" style="padding: 15px; border-bottom: 1px solid #e5e7eb; ${!notification.read ? 'background: #f0f9ff;' : ''} cursor: pointer;" onclick="markNotificationRead('${notification.id}')">
            <div style="display: flex; align-items: start; gap: 12px;">
                <div style="width: 40px; height: 40px; background: ${notification.type === 'order_approved' ? '#10b981' : '#ef4444'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;">
                    <i class="fas ${notification.type === 'order_approved' ? 'fa-check' : 'fa-times'}"></i>
                </div>
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 5px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${notification.title}</h4>
                    <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 13px;">${notification.message}</p>
                    <small style="color: #9ca3af; font-size: 12px;">
                        <i class="fas fa-clock"></i> ${new Date(notification.created_at).toLocaleString()}
                    </small>
                </div>
            </div>
        </div>
    `).join('');
}

function toggleNotifications() {
    const dropdown = document.getElementById('notifications-dropdown');
    if (dropdown) {
        if (dropdown.style.display === 'none') {
            dropdown.style.display = 'block';
            loadNotifications();
        } else {
            dropdown.style.display = 'none';
        }
    }
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
                updateNotificationBadge();
                displayNotifications();
            }
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function clearAllNotifications() {
    if (!currentUser) return;
    
    if (!confirm('Clear all notifications?')) return;
    
    try {
        const response = await fetch(`/api/notifications/${currentUser.id}/clear`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            notifications = [];
            updateNotificationBadge();
            displayNotifications();
        }
    } catch (error) {
        console.error('Error clearing notifications:', error);
    }
}

window.checkout = checkout;
window.closeModal = closeModal;
window.closeCheckoutModal = closeCheckoutModal;
window.showProductModal = showProductModal;
window.addToCart = addToCart;
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;
window.signOut = signOut;
window.refreshMarketplace = refreshMarketplace;
window.manualRefresh = manualRefresh;
window.deleteMaterial = deleteMaterial;
