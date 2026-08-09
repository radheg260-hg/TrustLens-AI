import os

import certifi
from services.ai_service import analyze_message_with_ai
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from routes.auth import init_auth_routes
from routes.scans import init_scan_routes
from routes.contact import init_contact_routes


# ==========================================================
# TRUSTLENS AI — BACKEND
# Phase 2.6
#
# Includes:
# - Flask API
# - MongoDB
# - JWT authentication
# - Scan routes
# - Contact routes
# - Rate limiting
# - CORS
# - Environment configuration
# ==========================================================


# ==========================================================
# LOAD ENVIRONMENT VARIABLES
# ==========================================================

load_dotenv()


# ==========================================================
# CREATE FLASK APP
# ==========================================================

app = Flask(__name__)


# ==========================================================
# ENVIRONMENT CONFIGURATION
# ==========================================================

MONGODB_URI = os.getenv(
    "MONGODB_URI"
)

MONGO_DB_NAME = os.getenv(
    "MONGO_DB_NAME",
    "trustlens"
)

JWT_SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY"
)


# ==========================================================
# REQUIRED ENVIRONMENT CHECKS
# ==========================================================

if not MONGODB_URI:
    raise RuntimeError(
        "MONGODB_URI is missing. "
        "Add it to backend/.env"
    )


if not JWT_SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY is missing. "
        "Add it to backend/.env"
    )


# ==========================================================
# JWT CONFIGURATION
# ==========================================================

app.config[
    "JWT_SECRET_KEY"
] = JWT_SECRET_KEY


# Optional JWT configuration.
# You can change these later if needed.

app.config[
    "JWT_TOKEN_LOCATION"
] = [
    "headers"
]


# ==========================================================
# JWT MANAGER
# ==========================================================

jwt = JWTManager(
    app
)


# ==========================================================
# CORS
# ==========================================================

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "http://127.0.0.1:5500",
                "http://localhost:5500",
                "https://trustlens-ai-ehlg.onrender.com"
            ]
        }
    }
)


# ==========================================================
# RATE LIMITER
# ==========================================================

limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    storage_uri="memory://"
)


# ==========================================================
# MONGODB CONNECTION
# ==========================================================

mongo_client = MongoClient(
    MONGODB_URI,

    tls=True,

    tlsCAFile=
        certifi.where(),

    serverSelectionTimeoutMS=
        5000
)


db = mongo_client[
    MONGO_DB_NAME
]


# ==========================================================
# DATABASE COLLECTIONS
# ==========================================================

users_collection = db[
    "users"
]

scans_collection = db[
    "scans"
]

contact_messages_collection = db[
    "contact_messages"
]


# ==========================================================
# DATABASE INITIALIZATION
# ==========================================================

def initialize_database():

    try:

        mongo_client.admin.command(
            "ping"
        )

        # ----------------------------------------------
        # USERS
        # ----------------------------------------------

        users_collection.create_index(
            [("email", 1)],
            name="users_email_unique",
            unique=True
        )

        # ----------------------------------------------
        # SCANS
        # ----------------------------------------------

        scans_collection.create_index(
            [
                ("user_id", 1),
                ("created_at", -1)
            ],
            name="scans_user_created"
        )

        # ----------------------------------------------
        # CONTACT MESSAGES
        # ----------------------------------------------

        contact_messages_collection.create_index(
            [
                ("user_id", 1),
                ("created_at", -1)
            ],
            name="contact_user_created"
        )

        contact_messages_collection.create_index(
            [("status", 1)],
            name="contact_status"
        )

        app.logger.info(
            "MongoDB collections and indexes initialized."
        )

    except PyMongoError as error:

        app.logger.error(
            "Database initialization failed: %s",
            error
        )


# ==========================================================
# REGISTER AUTH ROUTES
# ==========================================================

auth_blueprint = init_auth_routes(
    users_collection
)

app.register_blueprint(
    auth_blueprint
)


# ==========================================================
# REGISTER SCAN ROUTES
# ==========================================================

scan_blueprint = init_scan_routes(
    scans_collection
)

app.register_blueprint(
    scan_blueprint
)


# ==========================================================
# REGISTER CONTACT ROUTES
# ==========================================================

contact_blueprint = init_contact_routes(
    contact_messages_collection,
    users_collection,
    limiter
)

app.register_blueprint(
    contact_blueprint
)


# ==========================================================
# HOME ROUTE
# ==========================================================

@app.route(
    "/",
    methods=[
        "GET"
    ]
)
def home():

    return jsonify({
        "success": True,
        "app":
            "TrustLens AI",
        "message":
            "TrustLens AI backend is running.",
        "version":
            "2.6"
    }), 200


# ==========================================================
# HEALTH CHECK
# ==========================================================

@app.route(
    "/api/health",
    methods=[
        "GET"
    ]
)
def health_check():

    try:

        mongo_client.admin.command(
            "ping"
        )

        database_status ="connected"


    except PyMongoError:

        database_status ="disconnected"


    return jsonify({

        "success":
            database_status
            == "connected",

        "status":
            (
                "healthy"
                if database_status
                == "connected"
                else "degraded"
            ),

        "service":
            "TrustLens AI API",

        "database":
            database_status

    }), (
        200
        if database_status
        == "connected"
        else 503
    )


# ==========================================================
# BACKEND CONNECTION TEST
# ==========================================================

@app.route(
    "/api/test-connection",
    methods=[
        "GET"
    ]
)
def test_connection():

    return jsonify({

        "success":
            True,

        "message":
            "Frontend successfully connected to TrustLens backend."

    }), 200


# ==========================================================
# DATABASE TEST
# ==========================================================

@app.route(
    "/api/database-test",
    methods=[
        "GET"
    ]
)
def database_test():

    try:

        mongo_client.admin.command(
            "ping"
        )


        return jsonify({

            "success":
                True,

            "database":
                MONGO_DB_NAME,

            "message":
                "TrustLens successfully connected to MongoDB."

        }), 200


    except PyMongoError as error:

        app.logger.error(
            "MongoDB connection failed: %s",
            error
        )


        return jsonify({

            "success":
                False,

            "message":
                "TrustLens could not connect to MongoDB."

        }), 503


# ==========================================================
# DATABASE INFO
# ==========================================================

@app.route(
    "/api/database-info",
    methods=[
        "GET"
    ]
)
def database_info():

    try:

        mongo_client.admin.command(
            "ping"
        )


        collections = db.list_collection_names()


        return jsonify({

            "success":
                True,

            "database":
                MONGO_DB_NAME,

            "collections":
                collections

        }), 200


    except PyMongoError as error:

        app.logger.error(
            "Unable to read database information: %s",
            error
        )


        return jsonify({

            "success":
                False,

            "message":
                "Could not read database information."

        }), 503


# ==========================================================
# JWT ERROR HANDLERS
# ==========================================================

@jwt.unauthorized_loader
def missing_token_callback(
    error
):

    return jsonify({

        "success":
            False,

        "message":
            "Authorization token is required."

    }), 401


@jwt.invalid_token_loader
def invalid_token_callback(
    error
):

    return jsonify({

        "success":
            False,

        "message":
            "Invalid authentication token."

    }), 422


@jwt.expired_token_loader
def expired_token_callback(
    jwt_header,
    jwt_payload
):

    return jsonify({

        "success":
            False,

        "message":
            "Your login session has expired. Please sign in again."

    }), 401


# ==========================================================
# RATE LIMIT ERROR
# ==========================================================

@app.errorhandler(429)
def rate_limit_exceeded(
    error
):

    return jsonify({

        "success":
            False,

        "message":
            "Too many requests. Please try again later."

    }), 429


# ==========================================================
# 404
# ==========================================================

@app.errorhandler(404)
def not_found(
    error
):

    return jsonify({

        "success":
            False,

        "error":
            "Endpoint not found."

    }), 404


# ==========================================================
# 405
# ==========================================================

@app.errorhandler(405)
def method_not_allowed(
    error
):

    return jsonify({

        "success":
            False,

        "error":
            "Method not allowed."

    }), 405


# ==========================================================
# 500
# ==========================================================

@app.errorhandler(500)
def internal_server_error(
    error
):

    app.logger.error(
        "Internal server error: %s",
        error
    )


    return jsonify({

        "success":
            False,

        "error":
            "Internal server error."

    }), 500


# ==========================================================
# START SERVER
# ==========================================================

if __name__ == "__main__":

    initialize_database()

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=os.getenv(
            "FLASK_DEBUG",
            "false"
        ).lower() == "true"
    )