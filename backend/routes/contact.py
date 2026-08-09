import re
from datetime import datetime, timezone

from bson import ObjectId
from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    get_jwt_identity,
    jwt_required
)
from pymongo.errors import PyMongoError


# ==========================================================
# TRUSTLENS AI — CONTACT ROUTES
# Phase 2.5
# ==========================================================

contact_bp = Blueprint(
    "contact",
    __name__,
    url_prefix="/api/contact"
)


def init_contact_routes(
    contact_messages_collection,
    users_collection,
    limiter
):

    # ======================================================
    # CREATE CONTACT MESSAGE
    # POST /api/contact
    # ======================================================

    @contact_bp.route(
        "",
        methods=["POST"]
    )
    @limiter.limit("5 per hour")
    @jwt_required()
    def create_contact_message():

        try:

            # ----------------------------------------------
            # AUTHENTICATED USER
            # ----------------------------------------------

            user_id = get_jwt_identity()

            if not ObjectId.is_valid(
                user_id
            ):

                return jsonify({
                    "success": False,
                    "message":
                        "Invalid user session."
                }), 401


            user_object_id = ObjectId(
                user_id
            )


            user = users_collection.find_one({
                "_id":
                    user_object_id
            })


            if not user:

                return jsonify({
                    "success": False,
                    "message":
                        "Authenticated user account was not found."
                }), 404


            # ----------------------------------------------
            # REQUEST DATA
            # ----------------------------------------------

            data = (
                request.get_json(
                    silent=True
                )
                or {}
            )


            # Identity comes from MongoDB,
            # not from editable frontend fields.

            name = str(
                user.get(
                    "name",
                    ""
                )
            ).strip()


            email = str(
                user.get(
                    "email",
                    ""
                )
            ).strip().lower()


            category = str(
                data.get(
                    "category",
                    ""
                )
            ).strip().lower()


            subject = str(
                data.get(
                    "subject",
                    ""
                )
            ).strip()


            message = str(
                data.get(
                    "message",
                    ""
                )
            ).strip()


            # ----------------------------------------------
            # EMAIL VALIDATION
            # ----------------------------------------------

            email_pattern = re.compile(
                r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
            )


            if not email_pattern.fullmatch(
                email
            ):

                return jsonify({
                    "success": False,
                    "message":
                        "Invalid account email."
                }), 400


            # ----------------------------------------------
            # NAME VALIDATION
            # ----------------------------------------------

            if not name:

                return jsonify({
                    "success": False,
                    "message":
                        "Name is required."
                }), 400


            if len(name) > 60:

                return jsonify({
                    "success": False,
                    "message":
                        "Name is too long."
                }), 400


            # ----------------------------------------------
            # CATEGORY VALIDATION
            # ----------------------------------------------

            allowed_categories = {
                "general",
                "feedback",
                "bug",
                "security",
                "support",
                "other"
            }


            if (
                category
                not in allowed_categories
            ):

                return jsonify({
                    "success": False,
                    "message":
                        "Invalid message category."
                }), 400


            # ----------------------------------------------
            # SUBJECT VALIDATION
            # ----------------------------------------------

            if len(subject) < 3:

                return jsonify({
                    "success": False,
                    "message":
                        "Subject is too short."
                }), 400


            if len(subject) > 100:

                return jsonify({
                    "success": False,
                    "message":
                        "Subject is too long."
                }), 400


            # ----------------------------------------------
            # MESSAGE VALIDATION
            # ----------------------------------------------

            if len(message) < 10:

                return jsonify({
                    "success": False,
                    "message":
                        "Message is too short."
                }), 400


            if len(message) > 1000:

                return jsonify({
                    "success": False,
                    "message":
                        "Message is too long."
                }), 400


            # ----------------------------------------------
            # CREATE CONTACT DOCUMENT
            # ----------------------------------------------

            contact_document = {

                "user_id":
                    user_object_id,

                "name":
                    name,

                "email":
                    email,

                "category":
                    category,

                "subject":
                    subject,

                "message":
                    message,

                "status":
                    "new",

                "created_at":
                    datetime.now(
                        timezone.utc
                    )
            }


            result = (
                contact_messages_collection
                .insert_one(
                    contact_document
                )
            )


            return jsonify({
                "success": True,

                "message":
                    "Your message has been sent successfully.",

                "contact_id":
                    str(
                        result.inserted_id
                    )
            }), 201


        except PyMongoError as error:

            print(
                "Contact database error:",
                error
            )


            return jsonify({
                "success": False,

                "message":
                    "Database error while sending your message."
            }), 500


        except Exception as error:

            print(
                "Contact route error:",
                error
            )


            return jsonify({
                "success": False,

                "message":
                    "TrustLens could not send your message."
            }), 500


    return contact_bp