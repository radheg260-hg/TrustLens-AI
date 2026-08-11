from datetime import datetime, timedelta, timezone
import hashlib
import secrets
import os
import resend
import bcrypt

from bson import ObjectId
from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    get_jwt_identity,
    jwt_required
)
from pymongo.errors import DuplicateKeyError, PyMongoError


auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/api/auth"
)
RESEND_API_KEY = os.getenv("RESEND_API_KEY")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def init_auth_routes(users_collection):
    """
    Register authentication routes using the users collection.
    """

    @auth_bp.route("/register", methods=["POST"])
    def register():
        try:
            data = request.get_json(silent=True) or {}

            name = str(
                data.get("name", "")
            ).strip()

            email = str(
                data.get("email", "")
            ).strip().lower()

            password = str(
                data.get("password", "")
            )

            if not name:
                return jsonify({
                    "success": False,
                    "message":
                        "Full name is required."
                }), 400

            if len(name) < 2:
                return jsonify({
                    "success": False,
                    "message":
                        "Full name must contain at least 2 characters."
                }), 400

            if not email:
                return jsonify({
                    "success": False,
                    "message":
                        "Email address is required."
                }), 400

            if (
                "@" not in email or
                "." not in email
            ):
                return jsonify({
                    "success": False,
                    "message":
                        "Please enter a valid email address."
                }), 400

            if len(password) < 8:
                return jsonify({
                    "success": False,
                    "message":
                        "Password must contain at least 8 characters."
                }), 400

            if not any(
                character.isalpha()
                for character in password
            ):
                return jsonify({
                    "success": False,
                    "message":
                        "Password must contain at least one letter."
                }), 400

            if not any(
                character.isdigit()
                for character in password
            ):
                return jsonify({
                    "success": False,
                    "message":
                        "Password must contain at least one number."
                }), 400

            existing_user = (
                users_collection.find_one({
                    "email": email
                })
            )

            if existing_user:
                return jsonify({
                    "success": False,
                    "message":
                        "An account already exists with this email."
                }), 409

            password_hash = (
                bcrypt.hashpw(
                    password.encode("utf-8"),
                    bcrypt.gensalt()
                )
                .decode("utf-8")
            )

            user_document = {
                "name": name,
                "email": email,
                "password_hash":
                    password_hash,
                "account_status":
                    "active",
                "is_demo": False
            }

            result = (
                users_collection.insert_one(
                    user_document
                )
            )

            return jsonify({
                "success": True,
                "message":
                    "Account created successfully.",
                "user": {
                    "id":
                        str(result.inserted_id),
                    "name":
                        name,
                    "email":
                        email
                }
            }), 201

        except DuplicateKeyError:
            return jsonify({
                "success": False,
                "message":
                    "An account already exists with this email."
            }), 409

        except PyMongoError as error:
            print(
                "MongoDB register error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Database error while creating account."
            }), 500

        except Exception as error:
            print(
                "Register error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Unable to create account."
            }), 500


    @auth_bp.route("/login", methods=["POST"])
    def login():
        try:
            data = request.get_json(
                silent=True
            ) or {}

            email = str(
                data.get("email", "")
            ).strip().lower()

            password = str(
                data.get("password", "")
            )

            if not email or not password:
                return jsonify({
                    "success": False,
                    "message":
                        "Email and password are required."
                }), 400

            user = (
                users_collection.find_one({
                    "email": email
                })
            )

            if not user:
                return jsonify({
                    "success": False,
                    "message":
                        "Email or password is incorrect."
                }), 401

            saved_password_hash = (
                user.get(
                    "password_hash",
                    ""
                )
            )

            if not saved_password_hash:
                return jsonify({
                    "success": False,
                    "message":
                        "This account cannot be authenticated."
                }), 401

            password_is_correct = (
                bcrypt.checkpw(
                    password.encode("utf-8"),
                    saved_password_hash.encode(
                        "utf-8"
                    )
                )
            )

            if not password_is_correct:
                return jsonify({
                    "success": False,
                    "message":
                        "Email or password is incorrect."
                }), 401

            if (
                user.get(
                    "account_status"
                ) != "active"
            ):
                return jsonify({
                    "success": False,
                    "message":
                        "This account is currently unavailable."
                }), 403

            user_id = str(
                user["_id"]
            )

            access_token = (
                create_access_token(
                    identity=user_id,
                    expires_delta=timedelta(
                        hours=12
                    )
                )
            )

            return jsonify({
                "success": True,
                "message":
                    "Login successful.",
                "access_token":
                    access_token,
                "user": {
                    "id":
                        user_id,
                    "name":
                        user.get(
                            "name",
                            "User"
                        ),
                    "email":
                        user.get(
                            "email",
                            ""
                        ),
                    "is_demo":
                        bool(
                            user.get(
                                "is_demo",
                                False
                            )
                        )
                }
            }), 200

        except PyMongoError as error:
            print(
                "MongoDB login error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Database error while signing in."
            }), 500

        except Exception as error:
            print(
                "Login error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Unable to sign in."
            }), 500

        # ======================================================
    # DEMO LOGIN
    # ======================================================

        # ======================================================
    # ISOLATED DEMO LOGIN
    # ======================================================

    @auth_bp.route("/demo", methods=["POST"])
    def demo_login():

        try:

            # Every demo session gets its own
            # temporary MongoDB user.

            demo_token = secrets.token_hex(8)

            demo_email = (
                f"demo-{demo_token}"
                "@trustlens.local"
            )

            demo_document = {

                "name":
                    "Demo User",

                "email":
                    demo_email,

                "password_hash":
                    "",

                "account_status":
                    "active",

                "is_demo":
                    True,

                "created_at":
                    datetime.now(
                        timezone.utc
                    )
            }


            result = (
                users_collection
                .insert_one(
                    demo_document
                )
            )


            user_id = str(
                result.inserted_id
            )


            access_token = (
                create_access_token(

                    identity=
                        user_id,

                    expires_delta=
                        timedelta(
                            hours=2
                        )
                )
            )


            return jsonify({

                "success":
                    True,

                "message":
                    "Private demo session started.",

                "access_token":
                    access_token,

                "user": {

                    "id":
                        user_id,

                    "name":
                        "Demo User",

                    "email":
                        "demo@trustlens.local",

                    "is_demo":
                        True
                }

            }), 200


        except PyMongoError as error:

            print(
                "MongoDB demo-login error:",
                error
            )

            return jsonify({
                "success":
                    False,

                "message":
                    "Unable to start demo session."
            }), 500


        except Exception as error:

            print(
                "Demo-login error:",
                error
            )

            return jsonify({
                "success":
                    False,

                "message":
                    "Unable to start demo session."
            }), 500
        # ======================================================
    # FORGOT PASSWORD
    # ======================================================

    @auth_bp.route("/forgot-password", methods=["POST"])
    def forgot_password():

        try:
            data = request.get_json(silent=True) or {}

            email = str(
                data.get("email", "")
            ).strip().lower()

            if not email:
                return jsonify({
                    "success": False,
                    "message": "Email address is required."
                }), 400

            user = users_collection.find_one({
                "email": email
            })

            # Do not reveal whether an email is registered.
            generic_message = (
                "If an account exists with this email, "
                "a password reset code will be sent."
            )

            if not user:
                return jsonify({
                    "success": True,
                    "message": generic_message
                }), 200

            # Demo account must never be reset.
            if user.get("is_demo", False):
                return jsonify({
                    "success": True,
                    "message": generic_message
                }), 200

            reset_code = str(
                secrets.randbelow(900000) + 100000
            )

            reset_code_hash = hashlib.sha256(
                reset_code.encode("utf-8")
            ).hexdigest()

            expires_at = (
                datetime.now(timezone.utc) +
                timedelta(minutes=10)
            )

            users_collection.update_one(
                {
                    "_id": user["_id"]
                },
                {
                    "$set": {
                        "password_reset_code_hash":
                            reset_code_hash,

                        "password_reset_expires_at":
                            expires_at
                    }
                }
            )

            # TEMPORARY DEVELOPMENT OUTPUT.
            # We will remove this once email delivery
            # is connected.
            if not RESEND_API_KEY:
                raise RuntimeError(
                     "RESEND_API_KEY is not configured."
    )

            resend.Emails.send({
    "from": "TrustLens <onboarding@resend.dev>",
    "to": [email],
    "subject": "Your TrustLens password reset code",
    "html": f"""
        <div style="font-family: Arial, sans-serif;">
            <h2>TrustLens Password Reset</h2>

            <p>
                We received a request to reset your
                TrustLens password.
            </p>

            <p>Your verification code is:</p>

            <h1 style="letter-spacing: 6px;">
                {reset_code}
            </h1>

            <p>
                This code expires in 10 minutes.
            </p>

            <p>
                If you did not request a password reset,
                you can ignore this email.
            </p>

            <p>
                Never share this code with anyone.
            </p>

            <p>
                — TrustLens AI
            </p>
        </div>
    """
})

            return jsonify({
                "success": True,
                "message": generic_message
            }), 200

        except PyMongoError as error:

            print(
                "MongoDB forgot-password error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Unable to process password reset."
            }), 500

        except Exception as error:

            print(
                "Forgot-password error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Unable to process password reset."
            }), 500
        # ======================================================
    # RESET PASSWORD
    # ======================================================

    @auth_bp.route("/reset-password", methods=["POST"])
    def reset_password():

        try:
            data = request.get_json(silent=True) or {}

            email = str(
                data.get("email", "")
            ).strip().lower()

            code = str(
                data.get("code", "")
            ).strip()

            new_password = str(
                data.get("new_password", "")
            )

            if not email or not code or not new_password:
                return jsonify({
                    "success": False,
                    "message":
                        "Email, reset code and new password are required."
                }), 400

            if (
                len(code) != 6 or
                not code.isdigit()
            ):
                return jsonify({
                    "success": False,
                    "message":
                        "Please enter a valid 6-digit reset code."
                }), 400

            # Use same password requirements as registration
            if len(new_password) < 8:
                return jsonify({
                    "success": False,
                    "message":
                        "Password must contain at least 8 characters."
                }), 400

            if not any(
                character.isalpha()
                for character in new_password
            ):
                return jsonify({
                    "success": False,
                    "message":
                        "Password must contain at least one letter."
                }), 400

            if not any(
                character.isdigit()
                for character in new_password
            ):
                return jsonify({
                    "success": False,
                    "message":
                        "Password must contain at least one number."
                }), 400

            user = users_collection.find_one({
                "email": email
            })

            if (
                not user or
                user.get("is_demo", False)
            ):
                return jsonify({
                    "success": False,
                    "message":
                        "Invalid or expired password reset request."
                }), 400

            saved_code_hash = str(
                user.get(
                    "password_reset_code_hash",
                    ""
                )
            )

            expires_at = user.get(
                "password_reset_expires_at"
            )

            if not saved_code_hash or not expires_at:
                return jsonify({
                    "success": False,
                    "message":
                        "Invalid or expired password reset request."
                }), 400

            # MongoDB may return a naive datetime depending
            # on configuration, so normalize it safely.
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(
                    tzinfo=timezone.utc
                )

            if datetime.now(timezone.utc) > expires_at:
                users_collection.update_one(
                    {
                        "_id": user["_id"]
                    },
                    {
                        "$unset": {
                            "password_reset_code_hash": "",
                            "password_reset_expires_at": ""
                        }
                    }
                )

                return jsonify({
                    "success": False,
                    "message":
                        "The password reset code has expired."
                }), 400

            submitted_code_hash = hashlib.sha256(
                code.encode("utf-8")
            ).hexdigest()

            if not secrets.compare_digest(
                submitted_code_hash,
                saved_code_hash
            ):
                return jsonify({
                    "success": False,
                    "message":
                        "The password reset code is incorrect."
                }), 400

            new_password_hash = (
                bcrypt.hashpw(
                    new_password.encode("utf-8"),
                    bcrypt.gensalt()
                )
                .decode("utf-8")
            )

            users_collection.update_one(
                {
                    "_id": user["_id"]
                },
                {
                    "$set": {
                        "password_hash":
                            new_password_hash
                    },
                    "$unset": {
                        "password_reset_code_hash": "",
                        "password_reset_expires_at": ""
                    }
                }
            )

            return jsonify({
                "success": True,
                "message":
                    "Password reset successfully. You can now sign in."
            }), 200

        except PyMongoError as error:

            print(
                "MongoDB reset-password error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Unable to reset password."
            }), 500

        except Exception as error:

            print(
                "Reset-password error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Unable to reset password."
            }), 500

    @auth_bp.route("/me", methods=["GET"])
    @jwt_required()
    def current_user():
        try:
            user_id = get_jwt_identity()

            if not ObjectId.is_valid(
                user_id
            ):
                return jsonify({
                    "success": False,
                    "message":
                        "Invalid user session."
                }), 401

            user = (
                users_collection.find_one({
                    "_id":
                        ObjectId(user_id)
                })
            )

            if not user:
                return jsonify({
                    "success": False,
                    "message":
                        "User account not found."
                }), 404

            return jsonify({
                "success": True,
                "user": {
                    "id":
                        str(user["_id"]),
                    "name":
                        user.get(
                            "name",
                            "User"
                        ),
                    "email":
                        user.get(
                            "email",
                            ""
                        ),
                    "account_status":
                        user.get(
                            "account_status",
                            "active"
                        ),
                    "is_demo":
                        bool(
                            user.get(
                                "is_demo",
                                False
                            )
                        )
                }
            }), 200

        except PyMongoError as error:
            print(
                "MongoDB current-user error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Unable to load user."
            }), 500

    return auth_bp