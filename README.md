# WingBuddy Backend API

A comprehensive backend API for the WingBuddy event-based social matching app, built with Node.js, Express, and MongoDB.

## 🚀 Features

- **User Authentication**: JWT-based login/signup with email and phone verification stubs
- **User Management**: Complete user profiles with interests, trust scores, and badges
- **Event System**: Create, join, and manage events and instant meetups
- **Matching Algorithm**: Smart user matching based on interests, location, and trust scores
- **Chat System**: In-app messaging for events and direct conversations
- **Trust & Safety**: Feedback system with trust score updates and moderation
- **RESTful API**: Clean, well-documented endpoints with validation

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Express-validator
- **Security**: Helmet, CORS, Rate limiting
- **Password Hashing**: bcryptjs

## 📁 Project Structure

```
backend/
├── src/
│   ├── models/          # MongoDB schemas and models
│   ├── routes/          # API route handlers
│   ├── middleware/      # Authentication and validation middleware
│   ├── config/          # Configuration files
│   ├── seeders/         # Database seeding scripts
│   └── server.js        # Main server file
├── package.json
├── env.example          # Environment variables template
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/wingbuddy
   JWT_SECRET=your-super-secret-jwt-key-change-in-production
   JWT_EXPIRE=7d
   ```

4. **Start MongoDB**
   ```bash
   # Local MongoDB
   mongod
   
   # Or use MongoDB Atlas cloud service
   ```

5. **Seed the database (optional)**
   ```bash
   npm run seed
   ```

6. **Start the server**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

The API will be available at `http://localhost:5000`

## 📊 Database Seeding

The seeder script creates sample data for testing:

- **5 sample users** with different interests and trust scores
- **5 sample events** including scheduled events and instant meetups
- **Test accounts** with credentials:
  - `alex@example.com` / `password123`
  - `sarah@example.com` / `password123`
  - `mike@example.com` / `password123`

Run the seeder:
```bash
npm run seed
```

## 🔐 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/verify-phone` - Phone verification (stub)
- `POST /api/auth/verify-id` - ID verification (stub)

### Users
- `GET /api/users/profile` - Get current user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/matches` - Get potential matches
- `GET /api/users/:id` - Get public user profile
- `GET /api/users/search` - Search users
- `DELETE /api/users/profile` - Deactivate account

### Events
- `GET /api/events` - List all events with filters
- `POST /api/events` - Create scheduled event
- `POST /api/events/instant` - Create instant meetup
- `GET /api/events/:id` - Get event details
- `POST /api/events/:id/join` - Join event
- `DELETE /api/events/:id/leave` - Leave event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Cancel event

### Chat
- `GET /api/chat` - Get user's chat conversations
- `POST /api/chat` - Create new chat
- `GET /api/chat/:id` - Get chat messages
- `POST /api/chat/:id/messages` - Send message
- `POST /api/chat/event/:eventId` - Access event chat
- `PUT /api/chat/:id/read` - Mark chat as read
- `DELETE /api/chat/:id` - Leave chat

### Feedback
- `POST /api/feedback` - Submit user feedback
- `GET /api/feedback/received` - Get received feedback
- `GET /api/feedback/given` - Get given feedback
- `GET /api/feedback/user/:userId` - Get public user feedback
- `GET /api/feedback/event/:eventId` - Get event feedback
- `PUT /api/feedback/:id` - Update feedback
- `DELETE /api/feedback/:id` - Delete feedback

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Protection**: Configurable cross-origin resource sharing
- **Helmet**: Security headers for Express apps

## 📱 Frontend Integration

The API is designed to work seamlessly with the WingBuddy React Native frontend:

- **CORS Configuration**: Pre-configured for mobile app development
- **Mobile-First Design**: API responses optimized for mobile consumption
- **Real-time Ready**: WebSocket support can be easily added for chat
- **Image Handling**: Support for image URLs (can be extended for file uploads)

## 🧪 Testing

Test the API endpoints using tools like:

- **Postman** or **Insomnia** for API testing
- **curl** for command-line testing
- **Thunder Client** (VS Code extension)

### Example API Calls

**Register a new user:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "password": "password123",
    "age": 25,
    "city": "San Francisco",
    "interests": ["Coffee & Tea", "Technology"],
    "bio": "Tech enthusiast who loves coffee and networking."
  }'
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

## 🚀 Deployment

### Environment Variables for Production

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/wingbuddy
JWT_SECRET=very-long-random-secret-key-here
JWT_EXPIRE=7d
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Deployment Options

- **Heroku**: Easy deployment with MongoDB Atlas
- **AWS**: EC2 with MongoDB on EC2 or Atlas
- **DigitalOcean**: Droplet with MongoDB
- **Railway**: Simple Node.js deployment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the API documentation
- Review the code comments
- Open an issue on GitHub

## 🔮 Future Enhancements

- **WebSocket Support**: Real-time chat and notifications
- **File Upload**: Image and document sharing
- **Push Notifications**: Mobile push notification service
- **Analytics**: User behavior and event analytics
- **Admin Panel**: Moderation and management tools
- **Payment Integration**: Premium features and event payments 

## External Integrations

### Eventbrite

- Add your Eventbrite personal OAuth token to `.env`:
  - `EVENTBRITE_TOKEN=your_eventbrite_oauth_token`
- Fetch external events via:
  - `GET /api/events/external?city=San%20Francisco&q=coffee&page=1&pageSize=20`
- The response includes mapped `events` and `pagination` compatible with the mobile app. 