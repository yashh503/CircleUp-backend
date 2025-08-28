const axios = require('axios');

const EVENTBRITE_BASE = 'https://www.eventbriteapi.com/v3';

function mapEventbriteToWingBuddy(event) {
  // Map Eventbrite event to our public Event shape minimal subset
  return {
    _id: event.id,
    title: event.name?.text || 'Untitled',
    description: event.description?.text || '',
    type: 'scheduled',
    category: event.category_id || 'Events',
    location: {
      name: event.venue?.name || event.online_event ? 'Online' : 'Venue',
      address: event.venue?.address?.localized_address_display || '',
      city: event.venue?.address?.city || '',
      coordinates: event.venue?.address?.latitude && event.venue?.address?.longitude
        ? { lat: Number(event.venue.address.latitude), lng: Number(event.venue.address.longitude) }
        : undefined,
    },
    dateTime: event.start?.utc || new Date().toISOString(),
    duration: 120,
    maxParticipants: 100,
    currentParticipants: 0,
    groupSize: 'large_group',
    ageRange: { min: 18, max: 100 },
    creator: {
      _id: 'eventbrite',
      name: event.organizer?.name || 'Eventbrite Organizer',
      age: 0,
      city: event.venue?.address?.city || '',
      interests: [],
      bio: '',
      phoneVerified: false,
      idVerified: false,
      trustScore: 80,
      badges: ['Event Organizer'],
      lastActive: new Date().toISOString(),
      photoUrl: undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    participants: [],
    status: 'upcoming',
    tags: [],
    isPrivate: false,
    requiresApproval: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isFull: false,
    isPast: false,
  };
}

async function fetchEventbriteEvents({ token, city, q, page = 1, pageSize = 20 }) {
  console.log(token, city, q, page = 1, pageSize = 20 , "test")
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  // Search Events endpoint: /events/search/
  // Docs: See Eventbrite Developers
  // const params = {
  //   'location.address': city || undefined,
  //   q: q || undefined,
  //   page,
  //   'expand': 'venue,category,organizer',
  //   'include_unavailable_events': false,
  //   'page_size': pageSize,
  //   'sort_by': 'date',
  // };
  const payload = {
      "place_id": "102031017",
      "online_events_only": false,
      "expand.destination_event": [
          "event_sales_status",
          "image",
          "primary_venue",
          "saves",
          "series",
          "ticket_availability",
          "primary_organizer"
      ]
  }

  const resp = await axios.post(
    `${EVENTBRITE_BASE}/destination/city-browse/`,
    payload,
    { headers } // this is the config, not mixed with body
  );  
  console.log(resp.data, "test")
  const events = resp.data?.events || [];
  const pagination = resp.data?.pagination || {};

  return {
    events: events.map(mapEventbriteToWingBuddy),
    pagination: {
      current: pagination.page || page,
      total: pagination.page_count || 1,
      hasMore: Boolean(pagination.has_more_items),
    },
  };
}

module.exports = {
  fetchEventbriteEvents,
}; 