// backend/database.js - MODIFIED FOR POSTGRESQL
require('dotenv').config(); // Load environment variables from .env file

// Import the Pool class from the 'pg' library
const { Pool } = require('pg');

// Create a new Pool instance. It will manage connections to your PostgreSQL database.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Get database URL from environment variables
    ssl: {
        // This is crucial for connecting to cloud PostgreSQL services like Supabase
        // as they use SSL. `rejectUnauthorized: false` is often needed for development
        // or if the certificate is self-signed/untrusted by default Node.js.
        // For production, you might configure specific CA certs.
        rejectUnauthorized: false
    },
    family: 4
});

// Event listener for when a client connects to the database
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database.');
});

// Event listener for errors on idle clients in the pool
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1); // Exit the process if a critical database error occurs
});

// Export a 'query' function that allows you to execute SQL queries using the pool.
// This abstracts away direct pool.query calls in your routes.
// We no longer run schema creation here; you'll run SQL queries directly in Supabase.
module.exports = {
    query: (text, params) => pool.query(text, params),
};