# GreenScore - Construction Materials Marketplace

A B2B marketplace designed to reduce construction waste by connecting sellers with surplus materials to buyers who need them. GreenScore addresses the problem of approximately 5% of construction materials (doors, knobs, toilets, tiles, etc.) that typically go to waste in landfills.

## 🌿 Features

### For Sellers
- **Dashboard**: Comprehensive seller dashboard with inventory statistics
- **Bulk Upload**: CSV upload functionality for bulk inventory management
- **Manual Entry**: Add individual items through a user-friendly form
- **Inventory Management**: View, filter, and search through your materials
- **Automatic Categorization**: Materials are automatically categorized based on their names

### For Buyers
- **Marketplace**: Browse materials by category with advanced filtering
- **Search**: Smart search across materials, brands, and specifications
- **Shopping Cart**: Add items to cart with quantity management
- **Checkout**: Complete B2B checkout process with platform fee calculation
- **Categories**: Materials organized into logical categories (Doors, Tiles, Hardware, etc.)

### Platform Features
- **Material Categories**: Doors, Tiles, Handles & Hardware, Toilets & Sanitary, Windows, Flooring, Lighting, Paint & Finishes, Plumbing, Electrical, and more
- **Condition Tracking**: New, Like New, Good, Fair condition ratings
- **Platform Fee**: 3% platform fee calculated during checkout
- **Responsive Design**: Modern, mobile-friendly interface
- **Real-time Updates**: Inventory quantities update in real-time

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start the server**
   ```bash
   npm start
   ```
   
   For development with auto-restart:
   ```bash
   npm run dev
   ```

3. **Access the application**
   - Main page: http://localhost:3000
   - Seller dashboard: http://localhost:3000/seller
   - Buyer marketplace: http://localhost:3000/buyer

## 📊 CSV Upload Format

Sellers can upload inventory using CSV files with the following columns:

| Column | Description | Required |
|--------|-------------|----------|
| photo | URL to product image | No |
| material | Name of the material | Yes |
| unit | Unit of measurement (pcs, sqft, etc.) | No |
| qty. | Available quantity | Yes |
| brand | Brand name | No |
| specs photo | URL to specifications image | No |
| specs | Detailed specifications | No |
| condition | Condition (new, like-new, good, fair) | No |
| mrp | Maximum retail price | No |
| price purchased | Original purchase price | No |
| price today | Current selling price | Yes |
| inventory value | Total inventory value | No |
| inventory type | Type of inventory | No |

### Example CSV Row:
```csv
photo,material,unit,qty.,brand,specs photo,specs,condition,mrp,price purchased,price today,inventory value,inventory type
https://example.com/door.jpg,Wooden Door,pcs,5,ABC Brand,,Solid wood door with frame,good,500,400,350,1750,surplus
```

## 🏗️ Architecture

### Backend (Node.js/Express)
- RESTful API endpoints
- File upload handling with Multer
- CSV processing
- In-memory data storage (easily replaceable with database)

### Frontend (Vanilla JavaScript)
- Responsive design with modern CSS
- Separate interfaces for sellers and buyers
- Real-time cart management
- Modal-based interactions

### Key API Endpoints
- `GET /api/categories` - Get all material categories
- `GET /api/materials` - Get all materials (buyer view)
- `GET /api/seller/:id/materials` - Get seller's materials
- `POST /api/materials` - Add single material
- `POST /api/upload-csv` - Bulk upload via CSV
- `POST /api/orders` - Place an order

## 🎨 Design Philosophy

- **B2B Focus**: Professional interface designed for business users
- **Sustainability**: Emphasizes waste reduction and environmental impact
- **User Experience**: Intuitive workflows for both sellers and buyers
- **Modern UI**: Clean, responsive design with professional styling
- **Accessibility**: Keyboard navigation and screen reader friendly

## 🔧 Customization

### Adding New Categories
Edit the `categories` array in `server.js` and update the `categorizeItem()` function to include new categorization logic.

### Modifying Platform Fee
Change the platform fee percentage in both `buyer.js` and the checkout calculation logic.

### Styling
All styles are contained in `public/styles.css` with CSS custom properties for easy theme customization.

## 📱 Mobile Responsiveness

The application is fully responsive and optimized for:
- Desktop computers
- Tablets
- Mobile phones
- Touch interfaces

## 🚀 Future Enhancements

- Database integration (PostgreSQL, MongoDB)
- User authentication and authorization
- Payment gateway integration
- Image upload functionality
- Advanced search with filters
- Seller verification system
- Order tracking and management
- Email notifications
- Analytics dashboard
- Multi-language support

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🌱 Environmental Impact

By facilitating the reuse of construction materials, GreenScore helps:
- Reduce landfill waste
- Lower carbon footprint of construction projects
- Promote circular economy principles
- Support sustainable building practices
- Create value from waste materials

---

**GreenScore** - Making construction more sustainable, one material at a time. 🌿
