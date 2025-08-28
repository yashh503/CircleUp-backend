const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Event = require('../models/Event');

// Sample data
const sampleUsers = [
  {
    name: 'Alex Johnson',
    email: 'alex@example.com',
    phone: '+1234567890',
    password: 'password123',
    age: 28,
    city: 'San Francisco',
    interests: ['Coffee & Tea', 'Technology', 'Networking'],
    bio: 'Tech enthusiast who loves meeting new people over coffee. Always up for interesting conversations about startups and innovation.',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    phoneVerified: true,
    idVerified: true,
    trustScore: 85,
    badges: ['Trusted Buddy', 'Event Organizer']
  },
  {
    name: 'Sarah Chen',
    email: 'sarah@example.com',
    phone: '+1234567891',
    password: 'password123',
    age: 25,
    city: 'San Francisco',
    interests: ['Food & Dining', 'Art & Culture', 'Photography'],
    bio: 'Foodie and amateur photographer. Love exploring new restaurants and capturing beautiful moments. Always excited to try new cuisines!',
    photoUrl: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
    phoneVerified: true,
    idVerified: false,
    trustScore: 72,
    badges: ['Social Butterfly']
  },
  {
    name: 'Mike Rodriguez',
    email: 'mike@example.com',
    phone: '+1234567892',
    password: 'password123',
    age: 32,
    city: 'San Francisco',
    interests: ['Sports & Fitness', 'Outdoor Activities', 'Music & Concerts'],
    bio: 'Fitness coach and outdoor enthusiast. Love hiking, running, and discovering new music. Always looking for workout buddies!',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    phoneVerified: true,
    idVerified: true,
    trustScore: 78,
    badges: ['Trusted Buddy']
  },
  {
    name: 'Emma Wilson',
    email: 'emma@example.com',
    phone: '+1234567893',
    password: 'password123',
    age: 27,
    city: 'San Francisco',
    interests: ['Books & Reading', 'Coffee & Tea', 'Language Exchange'],
    bio: 'Bookworm and language learner. Currently studying Spanish and love discussing literature over coffee. Always open to new book recommendations!',
    photoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    phoneVerified: false,
    idVerified: false,
    trustScore: 65,
    badges: ['Newcomer']
  },
  {
    name: 'David Kim',
    email: 'david@example.com',
    phone: '+1234567894',
    password: 'password123',
    age: 30,
    city: 'San Francisco',
    interests: ['Gaming', 'Technology', 'Board Games'],
    bio: 'Game developer and board game enthusiast. Love both digital and tabletop games. Always excited to meet fellow gamers!',
    photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    phoneVerified: true,
    idVerified: false,
    trustScore: 70,
    badges: ['Social Butterfly']
  }
];

const sampleEvents = [
  {
    title: 'Coffee & Tech Meetup',
    description: 'Join us for an informal coffee meetup where we discuss the latest in tech, startups, and innovation. All skill levels welcome!',
    type: 'scheduled',
    category: 'Coffee & Tea',
    location: {
      name: 'Blue Bottle Coffee',
      address: '66 Mint St, San Francisco, CA 94103',
      city: 'San Francisco',
      coordinates: { lat: 37.7749, lng: -122.4194 }
    },
    dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    duration: 120,
    maxParticipants: 8,
    groupSize: 'small_group',
    ageRange: { min: 21, max: 35 },
    tags: ['tech', 'startups', 'networking']
  },
  {
    title: 'Foodie Photography Walk',
    description: 'Explore the Mission District while taking photos of amazing food and street art. We\'ll stop at several food spots along the way.',
    type: 'scheduled',
    category: 'Food & Dining',
    location: {
      name: 'Mission Dolores Park',
      address: 'Dolores St & 19th St, San Francisco, CA 94114',
      city: 'San Francisco',
      coordinates: { lat: 37.7599, lng: -122.4268 }
    },
    dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    duration: 180,
    maxParticipants: 6,
    groupSize: 'small_group',
    ageRange: { min: 18, max: 40 },
    tags: ['photography', 'food', 'walking']
  },
  {
    title: 'Board Game Night',
    description: 'Come play some board games! We\'ll have a variety of games from simple party games to strategic board games. Snacks provided!',
    type: 'scheduled',
    category: 'Board Games',
    location: {
      name: 'Game Parlor',
      address: '1234 Market St, San Francisco, CA 94102',
      city: 'San Francisco',
      coordinates: { lat: 37.7849, lng: -122.4094 }
    },
    dateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
    duration: 240,
    maxParticipants: 12,
    groupSize: 'large_group',
    ageRange: { min: 18, max: 45 },
    tags: ['games', 'social', 'fun']
  },
  {
    title: 'Quick Coffee Chat',
    description: 'I\'m at this amazing coffee shop and would love some company! Perfect for a quick 1:1 chat.',
    type: 'instant',
    category: 'Coffee & Tea',
    location: {
      name: 'Ritual Coffee Roasters',
      address: '1026 Valencia St, San Francisco, CA 94110',
      city: 'San Francisco',
      coordinates: { lat: 37.7569, lng: -122.4204 }
    },
    dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    duration: 90,
    maxParticipants: 4,
    groupSize: '1:1',
    ageRange: { min: 18, max: 35 },
    tags: ['instant-meetup', 'coffee']
  },
  {
    title: 'Sunset Hike at Twin Peaks',
    description: 'Join us for a beautiful sunset hike at Twin Peaks. Moderate difficulty, amazing city views, and great photo opportunities!',
    type: 'scheduled',
    category: 'Outdoor Activities',
    location: {
      name: 'Twin Peaks',
      address: 'Twin Peaks Blvd, San Francisco, CA 94131',
      city: 'San Francisco',
      coordinates: { lat: 37.7516, lng: -122.4475 }
    },
    dateTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
    duration: 150,
    maxParticipants: 10,
    groupSize: 'small_group',
    ageRange: { min: 18, max: 50 },
    tags: ['hiking', 'sunset', 'outdoors']
  }
];

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wingbuddy');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Clear existing data
const clearData = async () => {
  try {
    await User.deleteMany({});
    await Event.deleteMany({});
    console.log('🗑️  Cleared existing data');
  } catch (error) {
    console.error('Error clearing data:', error);
  }
};

// Seed users
const seedUsers = async () => {
  try {
    const hashedUsers = await Promise.all(
      sampleUsers.map(async (user) => {
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(user.password, salt);
        return { ...user, password: hashedPassword };
      })
    );

    const createdUsers = await User.insertMany(hashedUsers);
    console.log(`👥 Created ${createdUsers.length} users`);
    return createdUsers;
  } catch (error) {
    console.error('Error seeding users:', error);
    throw error;
  }
};

// Seed events
const seedEvents = async (users) => {
  try {
    const eventsWithCreators = sampleEvents.map((event, index) => ({
      ...event,
      creator: users[index % users.length]._id
    }));

    const createdEvents = await Event.insertMany(eventsWithCreators);
    console.log(`📅 Created ${createdEvents.length} events`);
    return createdEvents;
  } catch (error) {
    console.error('Error seeding events:', error);
    throw error;
  }
};

// Add some participants to events
const addParticipants = async (users, events) => {
  try {
    for (const event of events) {
      // Add 2-4 random participants to each event
      const numParticipants = Math.floor(Math.random() * 3) + 2;
      const randomUsers = users
        .filter(user => user._id.toString() !== event.creator.toString())
        .sort(() => 0.5 - Math.random())
        .slice(0, numParticipants);

      for (const user of randomUsers) {
        await event.addParticipant(user._id, 'interested');
      }
    }
    console.log('👥 Added participants to events');
  } catch (error) {
    console.error('Error adding participants:', error);
  }
};

// Main seeding function
const seed = async () => {
  try {
    await connectDB();
    await clearData();
    
    const users = await seedUsers();
    const events = await seedEvents(users);
    await addParticipants(users, events);
    
    console.log('🎉 Database seeded successfully!');
    console.log('\n📊 Sample Data Summary:');
    console.log(`   Users: ${users.length}`);
    console.log(`   Events: ${events.length}`);
    console.log('\n🔑 Test Accounts:');
    console.log('   Email: alex@example.com, Password: password123');
    console.log('   Email: sarah@example.com, Password: password123');
    console.log('   Email: mike@example.com, Password: password123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

// Run seeder
if (require.main === module) {
  seed();
}

module.exports = { seed }; 