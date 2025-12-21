# 7TVote - Emote Voting System for 7TV

An unofficial web application that helps Twitch streamers manage their 7TV emote sets through community voting. 

## 🎯 Features

### Current Features
- **Twitch OAuth Integration** - Secure login with Twitch authentication
- **Emote Set Browsing** - View and explore your 7TV emote sets
- **Community Voting Events** - Create voting events for your community to vote on emotes
  - Vote to keep or remove emotes from your sets
  - Set duration or specific end times for voting
  - Restrict voting by follower status, subscriber status, or specific users
  - Real-time vote tracking
- **Voting Interface** - Clean, glassmorphic UI with responsive design
- **Profile Management** - Manage moderator permissions and voting delegates
- **Pagination & Filtering** - Browse large emote sets with search and sort options
- **Mobile Responsive** - Works on all screen sizes

### Upcoming Features
- **Emote Usage Statistics** - Data on how often emotes are used in chat
- **Viewer Emote Suggestions** - Queue system for emote suggestions with optional channel point integration
- **In-Chat Voting Events** - Chatbot that runs voting directly in Twitch chat
  - Channel point redeems to initiate votes

## 🛠️ Tech Stack

**Frontend:**
- HTML5, CSS3, JavaScript (ES6 modules)
- Glassmorphic design with CSS Grid and Flexbox
- Responsive design with media queries

**Backend:**
- Python 3.12+
- FastAPI (web framework)
- SQLAlchemy (ORM)
- Alembic (database migrations)
- PostgreSQL (database)
- Authlib (OAuth handling)

**APIs:**
- 7TV GraphQL API
- Twitch Helix API
- Twitch OAuth 2.0

**Deployment:**
- Render (hosting)
- PostgreSQL (managed database)

## 📋 Prerequisites

- Python 3.12+
- PostgreSQL
- Twitch Developer Account (for API credentials)
- 7TV account

## 🚀 Installation [This is intended as a hosted service more than a local tool]

### 1. Clone the repository
```bash
git clone https://github.com/hunter_hues/7tv-Voting-Practice.git
cd 7tv-Voting-Practice
```

### 2. Create a virtual environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Set up environment variables

Create a `.env` file in the root directory:

```env
# Twitch API Credentials (get from https://dev.twitch.tv/console)
TWITCH_CLIENT_ID=your_client_id_here
TWITCH_CLIENT_SECRET=your_client_secret_here
REDIRECT_URI=http://localhost:8000/auth/callback

# Application Settings
SECRET_KEY=your_secret_key_here
BASE_URL=http://localhost:8000

# Database
DATABASE_URL=postgresql://user:password@localhost/dbname
```

### 5. Set up the database

```bash
# Run migrations
alembic upgrade head
```

### 6. Run the application

```bash
uvicorn main:app --reload
```

The application will be available at `http://localhost:8000`

## 🎮 Usage

1. **Login** - Sign in with your Twitch account
2. **View Emote Sets** - Browse your 7TV emote sets
3. **Create Voting Event** - Start a voting event for your community
   - Select an emote set
   - Set voting duration or end time
   - Choose who can vote (all, followers, subscribers, specific users)
4. **Share** - Share the event with your community
5. **Monitor Results** - Watch votes come in real-time
6. **Act on Results** - Use the results to manage your emote sets

## 🔐 Twitch Developer Setup

1. Go to [Twitch Developer Console](https://dev.twitch.tv/console)
2. Click **"Register Your Application"**
3. Fill in the details:
   - **Name:** Your app name
   - **OAuth Redirect URLs:** `http://localhost:8000/auth/callback` (for local development)
   - **Category:** Website Integration
4. Copy your **Client ID** and **Client Secret** to your `.env` file

## 📁 Project Structure

```
7tv-Voting-Practice/
├── api/                    # Backend API endpoints
│   ├── auth.py            # Authentication routes
│   ├── emotes.py          # Emote fetching from 7TV
│   ├── votes.py           # Voting event management
│   ├── users.py           # User data endpoints
│   ├── mods.py            # Moderator management
│   └── twitch_api.py      # Twitch API integration
├── alembic/               # Database migrations
├── static/                # Frontend assets (optional organization)
│   ├── js/               # JavaScript modules
│   └── css/              # Stylesheets
├── index.html            # Main HTML file
├── styles.css            # Main stylesheet
├── main.js               # Main JavaScript entry point
├── main.py               # FastAPI application
├── database.py           # Database configuration
├── models.py             # SQLAlchemy models
├── requirements.txt      # Python dependencies
└── .env                  # Environment variables (not in repo)
```

## 🤝 Contributing

This is a learning project, but contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## 🙏 Acknowledgments

- [7TV](https://7tv.app/) - For the emote platform and API
- [Twitch](https://www.twitch.tv/) - For the streaming platform and API
- Built by [hunter-hues](https://github.com/hunter_hues)
